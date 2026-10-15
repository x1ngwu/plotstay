import {createFixtureContent as createContent} from './work-fixtures.ts';
import {testEntry} from './runtime.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chromium, expect, type Page } from '@playwright/test';
import { createContentSchema } from '@plotstay/contracts';
import { submitRevision, reviewRevision, unpublishContent, restorePublication, digest, browseWorld } from '@plotstay/domain';
import { parseBrowse } from '@plotstay/contracts';
import { fixture } from './helpers.ts';
import { seedDiscovery } from '../scripts/seed-discovery.ts';
import { unusedPort, waitFor, stop, artifactHash } from './runtime.ts';

test('phase 3 discovery, crawlability, trip, SEO and browser acceptance', {timeout:180000},async t=>{
 const f=await fixture();t.after(f.cleanup);await seedDiscovery(f.db,f.data);
 const added:{id:string;publicationId:string}[]=[];
 for(let i=0;i<55;i++){
   const c=await createContent(f.db,f.data.owner,createContentSchema.parse({worldId:f.data.latheId,placeId:f.data.forgePlace,kind:i%2?'stay':'experience',slug:'crawl-'+i,sourceLocale:'en',
     text:{title:'Crawl story '+i,description:'English searchable keyword',tags:['journey']},translations:{'zh-CN':{title:'分页故事 '+i,description:'中文已发布正文',tags:['旅行']}},attributes:{price:{amount:20,unit:i%2?'night':'person'},...(i%2?{}:{durationMinutes:60})}}));
   await submitRevision(f.db,f.data.owner,c.id,c.revisionId);const p=await reviewRevision(f.db,f.data.owner,c.id,c.revisionId,'publish','crawl fixture');added.push({id:c.id,publicationId:p.publicationId!});
 }
 const apiPort=await unusedPort(),webPort=await unusedPort();const apiUrl=`http://127.0.0.1:${apiPort}`,webUrl=`http://127.0.0.1:${webPort}`,origin='https://plotstay-phase3.invalid';
 const env={...process.env,PGOPTIONS:f.options,NODE_ENV:'production',SITE_INDEXABLE:'true',SITE_URL:origin,API_PORT:String(apiPort),API_HOST:'127.0.0.1',HOST:'127.0.0.1',PORT:String(webPort),WEB_ORIGIN:webUrl,API_INTERNAL_URL:apiUrl};
 const launch=(entry:string)=>{const child=spawn(process.execPath,[testEntry(entry)],{env,stdio:['ignore','pipe','pipe']});let logs='';child.stdout!.on('data',d=>logs+=d);child.stderr!.on('data',d=>logs+=d);t.after(()=>stop(child));return {child,logs:()=>logs};};
 const api=launch('apps/api/dist/server.mjs');await waitFor(apiUrl+'/api/health',api.child,api.logs);
 const web=launch('apps/web/server.mjs');await waitFor(webUrl+'/en',web.child,web.logs);
 const hash=await artifactHash();const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const parser=await browser.newPage();
 const inspect=async(path:string)=>{
   const response=await fetch(webUrl+path);const html=await response.text();
   const parsed=await parser.evaluate(html=>{const d=new DOMParser().parseFromString(html,'text/html');return {
     canonical:d.querySelector('link[rel=canonical]')?.getAttribute('href'),alternates:[...d.querySelectorAll('link[rel=alternate]')].map(a=>({tag:a.getAttribute('hreflang'),url:a.getAttribute('href')})),
     robots:d.querySelector('meta[name=robots]')?.getAttribute('content'),ids:[...d.querySelectorAll('.results-grid [data-content-id]')].map(e=>e.getAttribute('data-content-id')),
     details:[...d.querySelectorAll('.results-grid h3 a')].map(e=>e.getAttribute('href')!),next:d.querySelector('a[rel=next]')?.getAttribute('href'),
     browse:d.querySelector('[data-browse-all]')?.getAttribute('href'),title:d.querySelector('title')?.textContent};},html);
   return {...parsed,html,status:response.status};
 };
 const menu=async(p:Page)=>{await p.locator('.header-actions summary').click();};
 await t.test('no-script traversal starts at homepage, covers 55 plus demo and services without duplicates',async()=>{
   const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();
   await page.goto(webUrl+'/en');await expect(page.locator('.world-menu .menu-panel a')).toHaveCount(1);assert.ok(!(await page.locator('.world-menu').innerText()).includes('Harbour'));
   const expected=(await browseWorld(f.db,'en',parseBrowse(new URLSearchParams('view=results')))).listing.total;
   await page.locator('[data-browse-all]').click();const ids:string[]=[];
   for(;;){
     ids.push(...await page.locator('.results-grid [data-content-id]').evaluateAll(elements=>elements.map(e=>e.getAttribute('data-content-id')!)));
     const links=await page.locator('.results-grid h3 a').evaluateAll(elements=>elements.map(e=>e.getAttribute('href')!));
     for(const link of links)assert.equal((await fetch(webUrl+link)).status,200,link);
     if(!await page.locator('[rel=next]').count())break;await page.locator('[rel=next]').click();
   }
   assert.equal(ids.length,expected);assert.equal(new Set(ids).size,expected);assert.ok(expected>=73);
   await page.goto(webUrl+'/en?tab=services');await page.locator('[name=q]').fill('augmetic');await page.locator('[name=quantity]').fill('2');await page.locator('[data-search] button').click();
   await expect(page.locator('.results-grid h3 a')).toHaveCount(1);await page.locator('.results-grid h3 a').click();await expect(page.locator('.trip-summary')).toContainText('2');
   await menu(page);await page.getByRole('link',{name:'简体中文',exact:true}).click();assert.match(page.url(),/\/zh\/worlds\/lathe-worlds\/services\//);
   await page.locator('[data-back]').click();assert.match(page.url(),/type=services/);await context.close();
   t.diagnostic(`SSR links reached ${expected} distinct published entries, including 55 added bilingual homes/experiences and 2 services.`);
 });
 await t.test('paged SEO is self-referencing, reciprocal and included in sitemap; filtered/trip states noindex',async()=>{
   const first=await inspect('/en?view=results');assert.equal(first.canonical,origin+'/en?view=results');
   const second=await inspect('/en?view=results&page=2');assert.equal(second.canonical,origin+'/en?view=results&page=2');
   const zh=await inspect('/zh?view=results&page=2');assert.deepEqual(second.ids,zh.ids);assert.equal(zh.canonical,origin+'/zh?view=results&page=2');
   assert.ok(second.alternates.some(a=>a.url===zh.canonical));assert.ok(zh.alternates.some(a=>a.url===second.canonical));
   assert.equal((await inspect('/en?view=results&page=1&type=all&utm_source=test')).canonical,first.canonical);
   const sitemap=await (await fetch(webUrl+'/sitemap.xml')).text();assert.ok(sitemap.includes('/en?view=results&amp;page=2'));assert.ok(sitemap.includes('/services/augmetic-tune-up'));
   for(const query of ['type=services','place=orbital-docks','category=signals','q=Crawl','start=2026-10-09','guests=2']){
     const result=await inspect('/en?view=results&'+query);assert.equal(result.status,200);assert.equal(result.canonical,undefined);assert.equal(result.alternates.length,0);assert.equal(result.robots,'noindex, follow');
   }
   for(const query of ['page=0','page=99','page=-1','type=bad','place=other','category=unknown','world=unknown','start=2026-02-30','guests=0','page=2&page=3'])assert.equal((await inspect('/en?view=results&'+query)).status,404,query);
   assert.equal((await inspect('/en?q=absolutely-absent')).status,200);assert.equal((await inspect('/en?q=absolutely-absent&page=2')).status,404);
   assert.equal((await inspect('/en?world=test-harbour&view=results')).canonical,origin+'/en?world=test-harbour&view=results');
   assert.equal((await inspect('/en?world=test-harbour&view=results&page=2')).status,404);
 });
 await t.test('trip survives pagination, language, detail and back; keyword language resets page',async()=>{
   const page=await browser.newPage();await page.goto(webUrl+'/en?view=results&start=2026-10-09&end=2026-10-12&guests=3&rooms=2');
   await page.locator('[rel=next]').click();assert.equal(new URL(page.url()).searchParams.get('page'),'2');
   await menu(page);await page.getByRole('link',{name:'简体中文',exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('page'),'2');
   const back=page.url();await page.locator('.results-grid h3 a').first().click();await expect(page.locator('.trip-summary')).toContainText('2026-10-09');await expect(page.locator('.trip-summary')).toContainText('3 人');
   await page.locator('[data-back]').click();assert.equal(page.url(),back);
   await page.locator('.results-grid h3 a').first().click();await page.goBack();assert.equal(page.url(),back);
   await page.goto(webUrl+'/en?view=results&q=Crawl&page=2&guests=4');await menu(page);await page.getByRole('link',{name:'简体中文',exact:true}).click();
   assert.equal(new URL(page.url()).searchParams.get('q'),'Crawl');assert.equal(new URL(page.url()).searchParams.get('page'),null);assert.equal(new URL(page.url()).searchParams.get('guests'),'4');
   await page.goto(webUrl+'/en?world=test-harbour');await page.locator('.world-menu summary').click();await page.locator('.world-menu a').click();assert.equal(new URL(page.url()).search,'');
   await page.goto(webUrl+'/en/worlds/lathe-worlds/services/augmetic-tune-up?world=test-harbour&from=results&return=https://evil.invalid');assert.equal(await page.locator('[data-back]').getAttribute('href'),'/en');
   await page.close();
 });
 await t.test('desktop, tablet, mobile, keyboard, search types, image errors and action targets are usable',async()=>{
   const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/media/quarters.svg',route=>route.abort());
   for(const width of [1440,768,390])for(const lang of ['en','zh']){
     await page.setViewportSize({width,height:900});await page.goto(webUrl+'/'+lang);
     assert.equal(await page.locator('h1').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} ${lang}`);
     await menu(page);await page.getByRole('link',{name:lang==='en'?'Help centre':'帮助中心',exact:true}).first().focus();await page.keyboard.press('Escape');
     await expect(page.locator('.header-actions summary')).toBeFocused();assert.equal(await page.locator('.header-actions details').getAttribute('open'),null);
     await page.screenshot({path:`test-results/s3-${lang}-${width}.png`,fullPage:true});
   }
   await page.goto(webUrl+'/en');await page.locator('[name=rooms]').fill('2');await page.getByText('Services',{exact:true}).click();await expect(page.locator('[name=rooms]')).toBeDisabled();await expect(page.locator('[name=end]')).toBeDisabled();
   await page.locator('[name=quantity]').fill('3');await page.locator('[name=time]').selectOption('afternoon');await page.locator('[name=guests]').fill('2');await page.locator('[data-search] button').click();
   assert.equal(new URL(page.url()).searchParams.get('rooms'),null);await expect(page.locator('.results-grid h3 a')).toHaveCount(2);await page.locator('.results-grid h3 a').first().click();await expect(page.locator('.trip-summary')).toContainText('Afternoon');
   await page.goto(webUrl+'/zh/help');assert.equal(await page.locator('h1').innerText(),'旅途开始之前。');await page.goto(webUrl+'/en/host');await expect(page.locator('.info-page')).toContainText('Public registration');
   assert.deepEqual(errors,[]);await page.close();
 });
 await t.test('existing account manages a service with translated tags and category; anonymous and role menus work',async()=>{
   const context=await browser.newContext();const page=await context.newPage();await page.goto(webUrl+'/zh');await menu(page);await expect(page.locator('[data-sign-in]')).toBeVisible();await expect(page.locator('[data-manage]')).toBeHidden();
   await page.goto(webUrl+'/zh/admin');await page.locator('#login [name=email]').fill(f.credentials.email);await page.locator('#login [name=password]').fill(f.credentials.password);await page.locator('#login button').click();await expect(page.locator('#workspace')).toBeVisible();
   await page.locator('#new').click();await page.locator('[name=personaId]').selectOption(f.data.providerId!);await page.locator('#toggle-mode').click();await page.locator('[name=kind]').selectOption('service');await page.locator('[name=slug]').fill('browser-service');await page.locator('[name=amount]').fill('88');await page.locator('[name=category]').selectOption('maintenance');
   await page.locator('[name="en:title"]').fill('Browser service');await page.locator('[name="en:description"]').fill('Browser service description');await page.locator('[name="en:tags"]').fill('Browser tag');await page.locator('[name="en:hostName"]').fill('Browser provider');
   await page.locator('[name="en:serviceItems"]').fill('Inspection\nMaintenance report');
   await page.locator('[name="zh-CN:title"]').fill('浏览器服务');await page.locator('[name="zh-CN:description"]').fill('浏览器服务介绍');await page.locator('[name="zh-CN:tags"]').fill('浏览器标签');await page.locator('[name="zh-CN:hostName"]').fill('浏览器提供者');
   await page.locator('[name="zh-CN:serviceItems"]').fill('检查\n检修报告');
   await page.locator('#editor button[type=submit]').click();await expect(page.locator('#message')).toContainText('草稿已保存');await page.locator('#submit-revision').click();await expect(page.locator('#revision-state')).toContainText('待审核');await page.locator('#publish').click();await expect(page.locator('#revision-state')).toContainText('已审核');
   await page.goto(webUrl+'/zh?view=results&type=services&q=浏览器标签');await page.locator('.results-grid h3 a').click();await expect(page.locator('h1')).toHaveText('浏览器服务');await expect(page.locator('.detail-panel')).toContainText('示例经营者');await expect(page.locator('.detail-panel')).toContainText('检修与仪式');await expect(page.locator('.detail-panel')).toContainText('/ 次');
   await expect(page.locator('#service-items')).toContainText('检修报告');
   await menu(page);await expect(page.locator('[data-manage]')).toBeVisible();await expect(page.locator('[data-sign-out]')).toBeVisible();await page.locator('[data-sign-out]').click();await menu(page);await expect(page.locator('[data-sign-in]')).toBeVisible();
   const {rows:[user]}=await f.db.query("INSERT INTO users(email,password_hash) VALUES ($1,'unused') RETURNING id",[randomUUID()+'@test.invalid']);const token=randomUUID();await f.db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '1 hour')",[digest(token),user.id]);
   await context.addCookies([{name:'plotstay_session',value:token,url:webUrl+'/api',httpOnly:true,sameSite:'Strict'}]);await page.goto(webUrl+'/en');await menu(page);await expect(page.locator('[data-sign-out]')).toBeVisible();await expect(page.locator('[data-manage]')).toBeHidden();
   await context.close();
 });
 await t.test('live unpublish and restore update page count, homepage and sitemap without rebuild',async()=>{
   for(const entry of added)await unpublishContent(f.db,f.data.owner,entry.id,false,'paging boundary');
   assert.equal((await inspect('/en?view=results&page=2')).status,404);let sitemap=await (await fetch(webUrl+'/sitemap.xml')).text();assert.ok(!sitemap.includes('view=results&amp;page=2'));
   for(const entry of added)await restorePublication(f.db,f.data.owner,entry.id,entry.publicationId);
   assert.equal((await inspect('/en?view=results&page=2')).status,200);sitemap=await (await fetch(webUrl+'/sitemap.xml')).text();assert.ok(sitemap.includes('view=results&amp;page=2'));
   assert.equal(await artifactHash(),hash);t.diagnostic(`Runtime publish/unpublish/restore preserved Web artifact SHA-256 ${hash}`);
 });
});
