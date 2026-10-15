import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium,expect} from '@playwright/test';
import {createApp} from '../apps/api/src/app.ts';
import {worksReviewFixture} from './works-review-fixture.ts';
import {unusedPort,waitFor,stop} from './runtime.ts';
import {saveWork,workDetail} from '../packages/domain/src/works.ts';
import {editContentSchema} from '@plotstay/contracts';

const dir=new URL('../docs/workspace-handoff/works-implementation/review-fixes/',import.meta.url);
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
test('R2/R4/R5 real API browser: readback input, retry selections and persistent modal', {timeout:180000},async t=>{
  const f=await worksReviewFixture();t.after(f.cleanup);
  const apiPort=await unusedPort(),webPort=await unusedPort(),origin=`http://127.0.0.1:${webPort}`;
  const app=await createApp(f.db,{webOrigin:origin,cookieSecure:false});await app.listen({host:'127.0.0.1',port:apiPort});t.after(()=>app.close());
  const build=process.env.PLOTSTAY_TEST_BUILD!;assert.ok(build?.startsWith('/tmp/'));
  const web=spawn(process.execPath,[build+'/web-server.mjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(webPort),API_INTERNAL_URL:`http://127.0.0.1:${apiPort}`,WEB_ORIGIN:origin,SITE_INDEXABLE:'false',DOTENV_CONFIG_PATH:'/dev/null'},stdio:['ignore','pipe','pipe']});
  let logs='';web.stdout.on('data',v=>logs+=v);web.stderr.on('data',v=>logs+=v);t.after(()=>stop(web));await waitFor(origin+'/api/locales',web,()=>logs);
  const browser=await chromium.launch();t.after(()=>browser.close());
  const context=await browser.newContext();await context.request.post(origin+'/api/auth/login',{headers:{origin},data:{email:f.author.email,password:f.password}});
  const page=await context.newPage();page.on('dialog',d=>d.accept());const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await mkdir(new URL('screenshots/',dir),{recursive:true});const cases:string[]=[];
  const shot=async(name:string)=>page.screenshot({path:new URL('screenshots/'+name+'.png',dir).pathname,fullPage:true});
  for(const lang of ['en','zh'])for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    const params={view:'create',ck:'stay',cw:f.data.latheId,cp:f.persona.id};
    await page.route('**/api/me/works/create-options',r=>r.abort());
    await page.goto(origin+`/${lang}/workspace?`+new URLSearchParams(params));
    await expect(page.locator('.empty')).toBeVisible();
    for(const [key,value]of Object.entries(params))assert.equal(new URL(page.url()).searchParams.get(key),value);
    await page.unroute('**/api/me/works/create-options');await page.locator('[data-action=retry]').click();
    await expect(page.locator('#create-form')).toBeVisible();await expect(page.locator('[name=kind][value=stay]')).toBeChecked();
    await expect(page.locator('#world-create')).not.toContainText(lang==='en'?'Search and select':'搜索并选择');
    await expect(page.locator('#persona-create')).toContainText(lang==='en'?'Review operator':'审查测试经营角色');
    await shot(`r4-prefill-retried-${lang}-${width}`);cases.push(`R4 prefill survives initial failure and retry ${lang}/${width}`);

    // The form only clears a selection after a successful response confirms it is unavailable.
    if(lang==='en'&&width===1440){
      await page.route('**/api/me/works/create-options',async r=>{const response=await r.fetch();const body=await response.json();body.personas=[];await r.fulfill({response,json:body});});
      await page.reload();await expect(page.locator('#create-form')).toContainText('no available saved persona');assert.equal(new URL(page.url()).searchParams.has('cp'),false);
      await page.unroute('**/api/me/works/create-options');cases.push('R4 successful permission change still clears invalid persona');
    }
    await page.goto(origin+`/${lang}/workspace?view=works`);await expect(page.locator('#result-count')).toBeVisible();
    for(const decision of ['cancel','apply','escape']){
      const ready=deferred(),gate=deferred();
      await page.route('**/api/me/works?*',async r=>{const response=await r.fetch();ready.resolve();await gate.promise;await r.fulfill({response});});
      await page.locator('[data-action=clear]').click();await ready.promise;
      await page.locator('[data-action=more]').click();const checkbox=page.locator('#more-dialog [value=public]');await checkbox.check();await checkbox.focus();
      gate.resolve();await expect(page.locator('#result-count')).toBeVisible();
      await expect(page.locator('#more-dialog')).toBeVisible();await expect(checkbox).toBeChecked();await expect(checkbox).toBeFocused();
      await page.unroute('**/api/me/works?*');
      if(decision==='cancel')await page.locator('[data-action=cancel-more]').last().click();
      else if(decision==='escape')await checkbox.press('Escape');
      else await page.locator('#more-dialog button[type=submit]').click();
      await expect(page.locator('#more-dialog')).not.toBeVisible();await expect(page.locator('[data-action=more]')).toBeFocused();
      await expect(page.locator('#result-count')).toBeVisible();
      assert.equal(new URL(page.url()).searchParams.get('visibility'),decision==='apply'?'public':null);
      cases.push(`R5 delayed response preserves dialog and ${decision} ${lang}/${width}`);
    }
    await page.locator('[data-action=more]').click();await shot(`r5-modal-${lang}-${width}`);await page.locator('[data-action=cancel-more]').last().click();

    await page.goto(origin+`/${lang}/workspace?`+new URLSearchParams({view:'editor',author:'1',content:f.work.id,world:f.data.latheId}));
    const title=page.locator('[name="en.title"]');await expect(title).toBeVisible();await title.fill(`POST snapshot ${lang}/${width}`);
    const ready=deferred(),gate=deferred();
    await page.route('**/api/me/works/'+f.work.id,async r=>{const response=await r.fetch();ready.resolve();await gate.promise;await r.fulfill({response});});
    await page.locator('#editor button[type=submit]').click();await ready.promise;
    const late=`New input during readback ${lang}/${width}`;await title.fill(late);gate.resolve();
    await expect(page.locator('#message')).toContainText(lang==='en'?'Changes made during saving remain unsaved':'保存期间的新修改仍未保存');
    await expect(title).toHaveValue(late);await expect(page.locator('#draft-preview-state')).toContainText(lang==='en'?'Unsaved':'未保存');
    assert.notEqual((await workDetail(f.db,f.author,f.work.id)).revisions[0].source_text.title,late);
    await shot(`r2-preserved-input-${lang}-${width}`);await page.unroute('**/api/me/works/'+f.work.id);
    await page.locator('#editor button[type=submit]').click();await expect(page.locator('#message')).toContainText(lang==='en'?'Draft saved':'草稿已保存');
    assert.equal((await workDetail(f.db,f.author,f.work.id)).revisions[0].source_text.title,late);
    cases.push(`R2 late input survives readback and saves on next explicit click ${lang}/${width}`);
  }

  // First save follows the same path and must establish an existing identity without duplicating a work.
  const slug='late-first-'+randomUUID();
  await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/en/workspace?'+new URLSearchParams({view:'editor',author:'1',new:'1',world:f.data.latheId,kind:'stay',provider:f.persona.id}));
  await expect(page.locator('#editor-panel')).toBeVisible();await page.locator('[name=slug]').fill(slug);await page.locator('[name=amount]').fill('125');await page.locator('#toggle-mode').click();
  await page.locator('[name="en:title"]').fill('First snapshot');await page.locator('[name="en:description"]').fill('First saved body');
  const ready=deferred(),gate=deferred();let firstId='';
  await page.route(/\/api\/me\/works\/[a-f0-9-]{36}$/,async r=>{firstId=r.request().url().split('/').at(-1)!;const response=await r.fetch();ready.resolve();await gate.promise;await r.fulfill({response});});
  await page.locator('#editor button[type=submit]').click();await ready.promise;await page.locator('[name="en:title"]').fill('Late first input');gate.resolve();
  await expect(page.locator('#message')).toContainText('Changes made during saving remain unsaved');await expect(page.locator('[name="en:title"]')).toHaveValue('Late first input');assert.equal(new URL(page.url()).searchParams.get('content'),firstId);
  await page.unroute(/\/api\/me\/works\/[a-f0-9-]{36}$/);await page.locator('#editor button[type=submit]').click();await expect(page.locator('#message')).toContainText('Draft saved');
  assert.equal((await f.db.query('SELECT count(*)::int n FROM contents WHERE slug=$1',[slug])).rows[0].n,1);assert.equal((await workDetail(f.db,f.author,firstId)).revisions[0].source_text.title,'Late first input');cases.push('R2 first save retains late input, records the ID and does not create twice');

  // A concurrent server head is not silently adopted as the local input's write base.
  await page.goto(origin+'/en/workspace?'+new URLSearchParams({view:'editor',author:'1',content:f.work.id,world:f.data.latheId}));await expect(page.locator('[name="en.title"]')).toBeVisible();await page.locator('[name="en.title"]').fill('Local concurrent snapshot');
  let newer='';await page.route('**/api/me/works/'+f.work.id,async r=>{
    const d=await workDetail(f.db,f.author,f.work.id);
    newer=(await saveWork(f.db,f.author,{requestId:randomUUID(),contentId:f.work.id,providerId:f.persona.id,expectedProviderId:f.persona.id,
      draft:editContentSchema.parse({baseRevisionId:d.content.head_revision_id,baseDraftToken:d.content.draft_token,sourceLocale:'en',text:{...d.revisions[0].source_text,title:'Other window saved'},translations:d.revisions[0].translations['zh-CN']?{'zh-CN':d.revisions[0].translations['zh-CN']}:{},attributes:d.revisions[0].attributes})})).revisionId;
    await r.fulfill({response:await r.fetch()});
  });
  await page.locator('#editor button[type=submit]').click();await expect(page.locator('#message')).toContainText('server changed again');await expect(page.locator('[name="en.title"]')).toHaveValue('Local concurrent snapshot');await page.unroute('**/api/me/works/'+f.work.id);
  await page.locator('#editor button[type=submit]').click();await expect(page.locator('#message')).toContainText('server changed again');assert.equal((await workDetail(f.db,f.author,f.work.id)).content.head_revision_id,newer);cases.push('R2 concurrent server update cannot silently become a new save base');
  assert.deepEqual(errors,[]);await writeFile(new URL('browser-evidence.json',dir),JSON.stringify({cases,errors,scope:'isolated PostgreSQL and real API; Chromium; no live database or deployment'},null,2)+'\n');
});

test('R1 old HTTP moderation rejects revoked replies and browser requires a fresh explicit submission',{timeout:120000},async t=>{
  const f=await worksReviewFixture();t.after(f.cleanup);
  const apiPort=await unusedPort(),webPort=await unusedPort(),origin=`http://127.0.0.1:${webPort}`;
  const app=await createApp(f.db,{webOrigin:origin,cookieSecure:false});await app.listen({host:'127.0.0.1',port:apiPort});t.after(()=>app.close());
  const build=process.env.PLOTSTAY_TEST_BUILD!;assert.ok(build?.startsWith('/tmp/'));
  const web=spawn(process.execPath,[build+'/web-server.mjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(webPort),API_INTERNAL_URL:`http://127.0.0.1:${apiPort}`,WEB_ORIGIN:origin,SITE_INDEXABLE:'false',DOTENV_CONFIG_PATH:'/dev/null'},stdio:['ignore','pipe','pipe']});
  let logs='';web.stdout.on('data',v=>logs+=v);web.stderr.on('data',v=>logs+=v);t.after(()=>stop(web));await waitFor(origin+'/api/locales',web,()=>logs);
  const browser=await chromium.launch();t.after(()=>browser.close());const author=await browser.newContext(),admin=await browser.newContext();
  for(const [context,credentials]of [[author,{email:f.author.email,password:f.password}],[admin,f.credentials]]as const)
    assert.equal((await context.request.post(origin+'/api/auth/login',{headers:{origin},data:credentials})).status(),200);
  const endpoint=origin+'/api/me/replies/'+f.review.id,moderation=origin+'/api/moderation/replies/'+f.review.id;
  const save=async(baseRevisionId:string|null)=>{const r=await author.request.put(endpoint,{headers:{origin},data:{baseRevisionId,body:{sourceLocale:'en',texts:{en:'Thank you for visiting','zh-CN':'谢谢来访'}}}});assert.equal(r.status(),200);return r.json();};
  const submit=async(revisionId:string)=>assert.equal((await author.request.post(endpoint+'/submit',{headers:{origin},data:{revisionId}})).status(),200);
  const access=async(action:'revoke'|'approve')=>assert.equal((await admin.request.post(origin+`/api/moderation/worlds/${f.data.latheId}/operating-access/${f.author.id}`,{headers:{origin},data:{action}})).status(),200);
  const first=await save(null);await submit(first.revisionId);assert.equal((await admin.request.post(moderation,{headers:{origin},data:{action:'publish',revisionId:first.revisionId}})).status(),200);
  const publication=(await(await author.request.get(endpoint)).json()).publications[0].id;
  const next=await save(first.revisionId);await submit(next.revisionId);await access('revoke');
  for(const action of ['publish','restore']){const r=await admin.request.post(moderation,{headers:{origin},data:{action,revisionId:next.revisionId,...action==='restore'?{publicationId:publication}:{}}});assert.equal(r.status(),403);assert.equal((await r.json()).error.code,'ELIGIBILITY_REVOKED');}
  const page=await author.newPage(),errors:string[]=[],dialogs:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());void d.accept();});
  await mkdir(new URL('screenshots/',dir),{recursive:true});
  for(const lang of ['zh','en'])for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.goto(origin+`/${lang}/workspace?view=replies&reply=${f.review.id}`);
    await expect(page.locator('[data-submission-expired]')).toBeVisible();await expect(page.locator('.rv-tags')).not.toContainText(lang==='en'?'Awaiting review':'有待审版本');
    await expect(page.locator('section.rv-note')).toContainText(lang==='en'?'eligibility was revoked':'经营资格已撤销');
    await page.screenshot({path:new URL(`screenshots/r1-revoked-reply-${lang}-${width}.png`,dir).pathname,fullPage:true});
  }
  await access('approve');const expired=await admin.request.post(moderation,{headers:{origin},data:{action:'publish',revisionId:next.revisionId}});assert.equal(expired.status(),409);assert.equal((await expired.json()).error.code,'SUBMISSION_EXPIRED');
  await page.goto(origin+`/en/workspace?view=replies&reply=${f.review.id}&mode=edit`);await expect(page.locator('#editor')).toBeVisible();
  await page.locator('#editor [data-action=save]').click();await expect(page.locator('#persona-message')).toContainText('Draft saved');
  await expect(page.locator('[data-submission-expired]')).toBeVisible();
  const submitted=page.waitForResponse(r=>r.url().endsWith('/api/me/review-workspace/save')&&r.request().method()==='POST');
  await page.locator('#editor [data-action=submit]').click();const result=await(await submitted).json();await expect(page.locator('#persona-message')).toContainText('saved and submitted');
  assert.deepEqual(dialogs,[]);await expect(page.locator('[data-submission-expired]')).toHaveCount(0);
  assert.equal((await admin.request.post(moderation,{headers:{origin},data:{action:'publish',revisionId:result.revisionId}})).status(),200);
  const detail=await(await author.request.get(endpoint)).json();assert.equal(detail.publications[0].revision_id,result.revisionId);assert.equal(detail.publications.length,2);
  assert.deepEqual(errors,[]);await writeFile(new URL('reply-browser-evidence.json',dir),JSON.stringify({oldApiRevokePublish:403,oldApiRevokeRestore:403,oldApiReapprovePublish:409,freshExplicitSubmissionPublish:200,bilingualViewportChecks:4,staleSubmissionAfterDraft:false,spuriousConfirmations:dialogs,errors},null,2)+'\n');
});
