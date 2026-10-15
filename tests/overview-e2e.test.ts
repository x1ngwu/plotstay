import {createFixtureContent as createContent} from './work-fixtures.ts';
import {testEntry} from './runtime.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {fixture} from './helpers.ts';
import {unusedPort,waitFor,stop} from './runtime.ts';
import {editContent,savePersona,initializeSettings,saveSetting,settingDetail} from '@plotstay/domain';
import {createContentSchema} from '@plotstay/contracts';

test('overview renders live summaries, isolates preferences and preserves precise object returns', {timeout:180000},async t=>{
 const f=await fixture();t.after(f.cleanup);const {db,data}=f;
 const input=createContentSchema.parse({worldId:data.latheId,kind:'stay',slug:'overview-browser',sourceLocale:'en',text:{title:'Following the old beacons: a long journey through the northern islands',description:'Saved by another creator'},translations:{'zh-CN':{title:'沿着旧航标去看黎明：雾港北岸的潮汐与灯塔漫游',description:'其他账号创建'}},attributes:{price:{amount:10,unit:'night'}}});
 const other=await createContent(db,data.owner,input);await editContent(db,data.admin,other.id,{...input,baseRevisionId:other.revisionId});
 const persona=await savePersona(db,data.admin,{en:{name:'Overview Wanderer',bio:'A persona draft',avatar:'mint'},'zh-CN':{name:'首页巡游者',bio:'角色草稿',avatar:'mint'}});
 await initializeSettings(db,data.admin,true);const setting=(await db.query("SELECT * FROM detail_settings WHERE kind='world' AND world_id=$1",[data.latheId])).rows[0];const settingsBody=(await settingDetail(db,data.admin,setting.id)).revisions[0].body;
 await saveSetting(db,data.admin,setting.id,settingsBody,setting.head_revision_id);
 const apiPort=await unusedPort(),webPort=await unusedPort(),apiUrl=`http://127.0.0.1:${apiPort}`,webUrl=`http://127.0.0.1:${webPort}`;
 const env={...process.env,PGOPTIONS:f.options,NODE_ENV:'production',SITE_INDEXABLE:'false',COOKIE_SECURE:'false',API_PORT:String(apiPort),API_HOST:'127.0.0.1',HOST:'127.0.0.1',PORT:String(webPort),WEB_ORIGIN:webUrl,API_INTERNAL_URL:apiUrl};
 const launch=(entry:string)=>{const child=spawn(process.execPath,[testEntry(entry)],{env,stdio:['ignore','pipe','pipe']});let logs='';child.stdout!.on('data',d=>logs+=d);child.stderr!.on('data',d=>logs+=d);t.after(()=>stop(child));return {child,logs:()=>logs};};
 const api=launch('apps/api/dist/server.mjs');await waitFor(apiUrl+'/api/health',api.child,api.logs);const web=launch('apps/web/server.mjs');await waitFor(webUrl+'/en',web.child,web.logs);
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());const context=await browser.newContext();const page=await context.newPage();const errors:string[]=[],requests:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(new URL(r.url()).pathname);});
 const login=await context.request.post(webUrl+'/api/auth/login',{headers:{Origin:webUrl},data:f.credentials});assert.equal(login.status(),200);
 await page.goto(webUrl+'/zh/workspace');await expect(page.locator('#ws-continue')).toContainText('首页巡游者');await expect(page.locator('#ov-worlds')).toBeHidden();assert.equal(requests.filter(p=>p==='/api/me/workspace').length,1);assert.equal(requests.filter(p=>p.includes('/contents')).length,0);
 await page.locator('[data-scope=mine]').press('ArrowRight');await expect(page.locator('[data-scope=assisted]')).toBeFocused();await expect(page.locator('#ws-continue')).toContainText('沿着旧航标');
 await page.locator('#ws-continue .ov-line a').filter({hasText:'沿着旧航标'}).click();await expect(page.locator('[name="en.title"]')).toHaveValue(input.text.title);await page.locator('#ws-back').click();await expect(page.locator('[data-scope=assisted]')).toHaveAttribute('aria-selected','true');await expect(page.locator('#ov-worlds')).toBeVisible();await expect(page.locator('.ov-world')).toHaveCount(1);
 await page.locator('.ov-pin').click();await expect(page.locator('.ov-pin')).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-scope=mine]').click();await page.locator('#ws-continue .ov-line a').filter({hasText:'首页巡游者'}).click();await expect(page.locator('[name="zh-CN.name"]')).toHaveValue('首页巡游者');await page.locator('[name="zh-CN.bio"]').fill('保存后的新资料');await page.getByRole('button',{name:'暂存草稿',exact:true}).click();await expect(page.locator('#persona-message')).toContainText('已保存');await page.locator('#ws-back').click();await expect(page.locator('[data-scope=mine]')).toHaveAttribute('aria-selected','true');
 // Historical revision opens read-only and never silently edits the newer version.
 await page.goto(webUrl+`/zh/workspace?view=personas&persona=${persona.id}&revision=${persona.revisionId}`);await expect(page.locator('#account-view')).toContainText('历史版本');await expect(page.locator('#account-view input')).toHaveCount(0);
 await page.goto(webUrl+'/zh/workspace?scope=assisted');await page.locator('#ws-continue a[href*="setting="]').first().click();await expect(page.locator('#settings-panel select').first()).toHaveValue(setting.id);await page.locator('#ws-back').click();await expect(page.locator('[data-scope=assisted]')).toHaveAttribute('aria-selected','true');
 // A preference-resolution failure does not clear work or lock navigation.
 await page.route('**/api/me/workspace/worlds?*',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"TEMPORARY"}}'}));await page.reload();await expect(page.locator('#ov-worlds')).toContainText('重试');await expect(page.locator('#ws-continue')).toContainText('沿着旧航标');await page.unroute('**/api/me/workspace/worlds?*');await page.locator('#ov-worlds button').click();await expect(page.locator('.ov-world')).toHaveCount(1);
 await mkdir('test-results/overview',{recursive:true});
 for(const locale of ['zh','en'])for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.goto(webUrl+`/${locale}/workspace`);await expect(page.locator('#ws-todo-count')).toBeVisible();await expect(page.locator('.ov-world')).toHaveCount(1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/overview/${locale}-mine-${width}.png`,fullPage:true});await page.locator('[data-scope=assisted]').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/overview/${locale}-assisted-${width}.png`,fullPage:true});assert.equal(await page.locator('#ws-overview').evaluate(el=>el.textContent?.includes('→')),false);}
 assert.deepEqual(errors,[]);
});
