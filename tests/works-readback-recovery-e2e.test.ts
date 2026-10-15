import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {createApp} from '../apps/api/src/app.ts';
import {worksReviewFixture} from './works-review-fixture.ts';
import {unusedPort,waitFor,stop} from './runtime.ts';
import {editContentSchema} from '@plotstay/contracts';
import {saveWork,workDetail} from '../packages/domain/src/works.ts';

const dir=new URL('../docs/workspace-handoff/works-implementation/review-fixes-2/',import.meta.url);
test('committed first save recovers GET failure without duplicate creation or overwriting later input',{timeout:120000},async t=>{
 const f=await worksReviewFixture();t.after(f.cleanup);
 const apiPort=await unusedPort(),webPort=await unusedPort(),origin=`http://127.0.0.1:${webPort}`;
 const app=await createApp(f.db,{webOrigin:origin,cookieSecure:false});await app.listen({host:'127.0.0.1',port:apiPort});t.after(()=>app.close());
 const build=process.env.PLOTSTAY_TEST_BUILD!;assert.ok(build?.startsWith('/tmp/'));
 const web=spawn(process.execPath,[build+'/web-server.mjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(webPort),API_INTERNAL_URL:`http://127.0.0.1:${apiPort}`,WEB_ORIGIN:origin,SITE_INDEXABLE:'false',DOTENV_CONFIG_PATH:'/dev/null'},stdio:['ignore','pipe','pipe']});
 let logs='';web.stdout.on('data',v=>logs+=v);web.stderr.on('data',v=>logs+=v);t.after(()=>stop(web));await waitFor(origin+'/api/locales',web,()=>logs);
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();
 await context.request.post(origin+'/api/auth/login',{headers:{origin},data:{email:f.author.email,password:f.password}});
 const page=await context.newPage();page.on('dialog',d=>d.accept());const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await mkdir(new URL('screenshots/',dir),{recursive:true});const cases:string[]=[];
 for(const [lang,width,mode] of [['en',1440,'edited'],['zh',390,'unchanged'],['en',390,'conflict']] as const){
  await page.setViewportSize({width,height:1000});const slug='recover-'+randomUUID();
  await page.goto(origin+`/${lang}/workspace?`+new URLSearchParams({view:'editor',author:'1',new:'1',world:f.data.latheId,kind:'stay',provider:f.persona.id}));
  await expect(page.locator('#editor-panel')).toBeVisible();await page.locator('[name=slug]').fill(slug);await page.locator('[name=amount]').fill('125');await page.locator('#toggle-mode').click();
  const title=page.locator('[name="en:title"]');await title.fill('Saved snapshot');await page.locator('[name="en:description"]').fill('Saved description');
  const posts:any[]=[];const onRequest=(r:any)=>{if(r.url().endsWith('/api/me/works/save'))posts.push(r.postDataJSON());};page.on('request',onRequest);
  const pattern=/\/api\/me\/works\/[a-f0-9-]{36}$/;await page.route(pattern,r=>r.fulfill({status:503,json:{error:{code:'REVIEW_GET_FAILURE',message:'Injected GET failure'}}}));
  const response=page.waitForResponse(r=>r.url().endsWith('/api/me/works/save'));await page.locator('#editor button[type=submit]').click();const first=await(await response).json();
  await expect(page.locator('#message')).toContainText(lang==='en'?'Content was saved, but details could not be loaded':'内容已保存，但详情读取失败');
  assert.equal(new URL(page.url()).searchParams.get('content'),first.id);
  if(mode!=='unchanged')await title.fill('Input after committed save');
  // Repeated GET failures must not produce another POST, even after the form changes.
  await page.locator('#editor button[type=submit]').click();await expect(page.locator('#editor button[type=submit]')).toBeEnabled();assert.equal(posts.length,1);
  if(mode==='conflict'){
   const d=await workDetail(f.db,f.author,first.id);await saveWork(f.db,f.author,{requestId:randomUUID(),contentId:first.id,providerId:f.persona.id,expectedProviderId:f.persona.id,draft:editContentSchema.parse({baseRevisionId:d.content.head_revision_id,baseDraftToken:d.content.draft_token,sourceLocale:'en',text:{title:'Other window',description:'Concurrent content'},attributes:d.revisions[0].attributes})});
  }
  await page.unroute(pattern);await page.locator('#editor button[type=submit]').click();
  if(mode==='conflict'){
   await expect(page.locator('#message')).toContainText('server changed again');await expect(title).toHaveValue('Input after committed save');assert.equal(posts.length,1);
   await page.locator('#editor button[type=submit]').click();await expect(page.locator('#message')).toContainText('server changed again');assert.equal(posts.length,1);
  }else{
   await expect(page.locator('#message')).toContainText(lang==='en'?'Draft saved':'草稿已保存');assert.equal(posts.length,mode==='edited'?2:1);
   if(mode==='edited')assert.equal(posts[1].contentId,first.id);
   const d=await workDetail(f.db,f.author,first.id);assert.equal(d.revisions.length,mode==='edited'?2:1);assert.equal(d.revisions[0].source_text.title,mode==='edited'?'Input after committed save':'Saved snapshot');
   await expect(page.locator('[name=slug]')).toBeDisabled();
  }
  assert.equal((await f.db.query('SELECT count(*)::int n FROM contents WHERE slug=$1',[slug])).rows[0].n,1);
  await page.screenshot({path:new URL(`screenshots/recovery-${mode}-${lang}-${width}.png`,dir).pathname,fullPage:true});cases.push(`${mode} / ${lang} / ${width}`);page.off('request',onRequest);
 }
 // The replacement API's legacy route must reject incomplete creation and atomically record valid ownership/binding.
 const admin=await browser.newContext();await admin.request.post(origin+'/api/auth/login',{headers:{origin},data:f.credentials});
 const persona=(await f.db.query('SELECT id FROM personas WHERE owner_id=$1 AND approved AND NOT disabled LIMIT 1',[f.data.admin.id])).rows[0].id;
 const invalid=await admin.request.post(origin+'/api/admin/contents',{headers:{origin},data:{...f.draft,slug:'missing-provider-'+randomUUID()}});assert.equal(invalid.status(),400);assert.equal((await invalid.json()).error.code,'PROVIDER_REQUIRED');
 const valid=await admin.request.post(origin+'/api/admin/contents',{headers:{origin},data:{...f.draft,slug:'legacy-fixed-'+randomUUID(),personaId:persona}});assert.equal(valid.status(),201);const work=await valid.json();
 assert.deepEqual((await f.db.query('SELECT o.owner_id,b.persona_id FROM work_ownership o JOIN provider_bindings b ON b.content_id=o.content_id WHERE o.content_id=$1',[work.id])).rows[0],{owner_id:f.data.admin.id,persona_id:persona});
 const submitted=await admin.request.post(origin+`/api/admin/contents/${work.id}/submit`,{headers:{origin},data:{revisionId:work.revisionId}});assert.equal(submitted.status(),200);
 assert.equal((await f.db.query('SELECT 1 FROM work_provider_locks WHERE content_id=$1',[work.id])).rowCount,1);
 assert.deepEqual(errors,[]);await writeFile(new URL('verification.json',dir),JSON.stringify({cases,legacyMissingProvider:400,legacyValidCreate:201,legacySubmit:200,ownerAndBindingAtomic:true,errors},null,2)+'\n');
});
