import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { chromium, expect, type Browser } from '@playwright/test';
import { fixture } from './helpers.ts';
import { unusedPort, waitFor, stop } from './runtime.ts';
import { createAccount, saveOwnPersona, savePersonaNotes, myPersonas } from '@plotstay/domain';
test('persona workspace async races', { timeout: 120000 }, async t => {
const f = await fixture();
const children:ChildProcess[] = [];
let browser:Browser | undefined;
const defer = () => {let resolve!:()=>void; const promise=new Promise<void>(r=>resolve=r); return {promise,resolve};};
try {
 const user=await createAccount(f.db,f.data.admin,{email:'review-races@tests.invalid',password:'review-tests-123'});
 const owner={id:user.id,email:user.email,siteRole:'user' as const};
 const profiles=(name:string)=>({en:{name,bio:'Initial bio',avatar:'mint'},'zh-CN':{name:'测试',bio:'测试简介',avatar:'mint'}});
 const cmd=(overrides:any={})=>({profiles:profiles('Alpha'),action:'draft',baseRevisionId:null,expectedSubmittedRevisionId:null,requestId:randomUUID(),...overrides});
 const a=await saveOwnPersona(f.db,owner,cmd());
 const b=await saveOwnPersona(f.db,owner,cmd({profiles:profiles('Beta')}));
 await savePersonaNotes(f.db,owner,a.id,{body:'Alpha private',baseVersion:null,requestId:randomUUID()});
 await savePersonaNotes(f.db,owner,b.id,{body:'Beta private',baseVersion:null,requestId:randomUUID()});
 const apiPort=await unusedPort(),webPort=await unusedPort(),apiUrl=`http://127.0.0.1:${apiPort}`,webUrl=`http://127.0.0.1:${webPort}`;
 const env={...process.env,PGOPTIONS:f.options,NODE_ENV:'production',SITE_INDEXABLE:'false',COOKIE_SECURE:'false',API_PORT:String(apiPort),API_HOST:'127.0.0.1',HOST:'127.0.0.1',PORT:String(webPort),WEB_ORIGIN:webUrl,API_INTERNAL_URL:apiUrl};
 const launch=(entry:string)=>{const child=spawn(process.execPath,[entry],{env,stdio:['ignore','pipe','pipe']});children.push(child);let logs='';child.stdout!.on('data',d=>logs+=d);child.stderr!.on('data',d=>logs+=d);return {child,logs:()=>logs};};
 const api=launch('apps/api/dist/server.mjs'); await waitFor(apiUrl+'/api/health',api.child,api.logs);
 const web=launch('apps/web/server.mjs'); await waitFor(webUrl+'/en',web.child,web.logs);
 browser=await chromium.launch(); const context=await browser.newContext();
 assert.equal((await context.request.post(webUrl+'/api/auth/login',{headers:{Origin:webUrl},data:{email:user.email,password:'review-tests-123'}})).status(),200);
 const page=await context.newPage(); const root=webUrl+'/en/workspace?view=personas';
 const edit=()=>page.goto(root+'&persona='+a.id);
 const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await t.test('refresh cannot silently adopt another window’s public version',async()=>{
   await edit(); await expect(page.locator('#wp-name')).toHaveValue('Alpha');
   await page.locator('#wp-name').fill('Window A');
   let foreign:any, savedBase:string;
   await page.route('**/api/me/personas',async route=>{
     const head=(await myPersonas(f.db,owner)).find(p=>p.id===a.id)!;
     savedBase=head.head_revision_id;
     foreign=await saveOwnPersona(f.db,owner,cmd({personaId:a.id,baseRevisionId:savedBase,profiles:profiles('Window B')}));
     await route.continue();
   });
   await page.locator('#wp-draft').click();
   await expect(page.locator('#wp-public-state')).toContainText('A newer version exists');
   await page.unroute('**/api/me/personas');
   await expect(page.locator('#wp-name')).toHaveValue('Window A');
   await page.locator('#wp-bio').fill('A next edit');
   const request=page.waitForRequest(r=>r.url().endsWith('/api/me/personas/save'));
   const response=page.waitForResponse(r=>r.url().endsWith('/api/me/personas/save'));
   await page.locator('#wp-draft').click();
   assert.equal((await request).postDataJSON().baseRevisionId,savedBase!);
   assert.equal((await response).status(),409);
   await expect(page.locator('#wp-public-state')).toContainText('A newer version exists');
   const latest=(await myPersonas(f.db,owner)).find(p=>p.id===a.id)!;
   assert.equal(latest.head_revision_id,foreign.revisionId);
   assert.equal(latest.draft.en.name,'Window B');
   await page.getByRole('button',{name:'Compare latest profile',exact:true}).click();
   await expect(page.locator('.wp-compare')).toContainText('Window B');
   await page.getByRole('button',{name:'Compared; keep my input',exact:true}).click();
   await expect(page.locator('#wp-name')).toHaveValue('Window A');
   await expect(page.locator('#wp-bio')).toHaveValue('A next edit');
   await page.locator('#wp-draft').click();
   await expect(page.locator('#wp-public-state')).toContainText('Draft saved');
   assert.equal((await myPersonas(f.db,owner)).find(p=>p.id===a.id)!.draft.en.bio,'A next edit');
 });
 for(const outcome of ['success','failure']) await t.test(`old notes ${outcome} cannot block or finish the next persona’s load`,async()=>{
   await edit(); await expect(page.locator('#wp-name')).toBeVisible();
   const aStarted=defer(),aRelease=defer(),aDone=defer(),bStarted=defer(),bRelease=defer();
   let bRequests=0;
   await page.route('**/api/me/personas/'+a.id+'/notes',async route=>{
     aStarted.resolve(); await aRelease.promise;
     if(outcome==='failure') await route.fulfill({status:500,json:{error:{code:'INTERNAL_ERROR'}}});
     else await route.fulfill({response:await route.fetch()});
     aDone.resolve();
   });
   await page.route('**/api/me/personas/'+b.id+'/notes',async route=>{
     bRequests++;bStarted.resolve();await bRelease.promise;await route.continue();
   });
   try {
     await page.locator('[data-tab=notes]').click();await aStarted.promise;
     await page.locator('#ws-back').click();await expect(page.locator('.wp-card')).toHaveCount(2);
     await page.locator('[data-persona="'+b.id+'"] .wp-edit').click();await expect(page.locator('#wp-name')).toHaveValue('Beta');
     await page.locator('[data-tab=notes]').click();await bStarted.promise;
     aRelease.resolve();await aDone.promise;
     await expect(page.locator('#wp-notes-state')).toHaveText('Loading notes…');
     await expect(page.locator('#wp-notes')).toBeDisabled();
     // Switching sections also must not launch a duplicate read after A finishes.
     await page.locator('[data-tab=public]').click();await page.locator('[data-tab=notes]').click();
     assert.equal(bRequests,1);
     bRelease.resolve();await expect(page.locator('#wp-notes')).toBeEnabled();
     await expect(page.locator('#wp-notes')).toHaveValue('Beta private');
     await expect(page.locator('#wp-notes-state')).toHaveText('Notes saved');
   } finally {
     aRelease.resolve();bRelease.resolve();
     await page.unroute('**/api/me/personas/'+a.id+'/notes');
     await page.unroute('**/api/me/personas/'+b.id+'/notes');
   }
 });
 for(const tab of ['public','notes']) await t.test(`new ${tab} input during navigation requires confirmation`,async()=>{
   await edit();await expect(page.locator('#wp-name')).toBeVisible();
   if(tab==='notes') {await page.locator('[data-tab=notes]').click();await expect(page.locator('#wp-notes')).toBeEnabled();}
   const from=page.url(),started=defer(),release=defer();
   await page.route('**/api/me/personas',async route=>{started.resolve();await release.promise;await route.continue();});
   try {
     await page.locator('#ws-back').click();await started.promise;
     assert.equal(page.url(),from);
     const input=page.locator(tab==='public'?'#wp-bio':'#wp-notes');
     await input.fill('Typed while navigation is pending');
     const dialog=page.waitForEvent('dialog');release.resolve();
     await (await dialog).dismiss();
     await expect(input).toHaveValue('Typed while navigation is pending');assert.equal(page.url(),from);
     await page.unroute('**/api/me/personas');
     page.once('dialog',d=>d.accept());await page.locator('#ws-back').click();
     await expect(page.locator('.wp-card')).toHaveCount(2);
     await page.goBack();await expect(page.locator('#wp-name')).toBeVisible();
     await page.goForward();await expect(page.locator('.wp-card')).toHaveCount(2);
   } finally {release.resolve();await page.unroute('**/api/me/personas');}
 });
 await t.test('failed navigation preserves the editor URL and both unsaved buffers',async()=>{
   await edit();await expect(page.locator('#wp-name')).toBeVisible();
   await page.locator('#wp-bio').fill('Public retained');
   await page.locator('[data-tab=notes]').click();await expect(page.locator('#wp-notes')).toBeEnabled();
   await page.locator('#wp-notes').fill('Private retained');const from=page.url();
   await page.route('**/api/me/personas',route=>route.abort('failed'));
   page.once('dialog',d=>d.accept());await page.locator('#ws-back').click();
   await expect(page.locator('#persona-message')).toContainText('operation did not complete');
   assert.equal(page.url(),from);await expect(page.locator('#wp-notes')).toHaveValue('Private retained');
   await page.locator('[data-tab=public]').click();await expect(page.locator('#wp-bio')).toHaveValue('Public retained');
   await page.unroute('**/api/me/personas');
 });
 for (const role of ['user', 'admin']) for (const sameContent of [false, true]) {
   await t.test(`conflict recovery for ${role}: retained input is ${sameContent ? 'identical' : 'different'}`, async () => {
     const account = role === 'admin' ? f.data.admin : owner;
     const credentials = role === 'admin' ? f.credentials : { email: user.email, password: 'review-tests-123' };
     const target = await saveOwnPersona(f.db, account, cmd({ profiles: profiles('Initial') }));
     const ctx = await browser!.newContext();
     try {
       assert.equal((await ctx.request.post(webUrl + '/api/auth/login', { headers: { Origin: webUrl }, data: credentials })).status(), 200);
       const p = await ctx.newPage();
       p.on('pageerror', e => errors.push(e.message));
       await p.goto(root + '&persona=' + target.id);
       await expect(p.locator('#wp-name')).toHaveValue('Initial');
       await p.locator('#wp-name').fill('Kept locally');
       let foreign: any;
       await p.route('**/api/me/personas', async route => {
         const head = (await myPersonas(f.db, account)).find(persona => persona.id === target.id)!;
         foreign = await saveOwnPersona(f.db, account, cmd({ personaId: target.id, baseRevisionId: head.head_revision_id,
           action: 'complete', profiles: profiles(sameContent ? 'Kept locally' : 'Changed elsewhere') }));
         await route.continue();
       });
       await p.locator('#wp-draft').click();
       await expect(p.locator('#wp-public-state')).toContainText('A newer version exists');
       await p.unroute('**/api/me/personas');
       // No additional edits before comparing: the local buffer was just saved.
       await p.getByRole('button', { name: 'Compare latest profile', exact: true }).click();
       await expect(p.locator('.wp-compare')).toContainText(sameContent ? 'Kept locally' : 'Changed elsewhere');
       await p.getByRole('button', { name: 'Compared; keep my input', exact: true }).click();
       await expect(p.locator('#wp-name')).toHaveValue('Kept locally');
       if (sameContent) {
         await expect(p.locator('[data-tab=public]')).not.toHaveClass(/wp-unsaved/);
         await expect(p.locator('#wp-public-state')).toContainText('matches the latest profile');
         await expect(p.locator('#wp-complete')).toBeDisabled();
         let dialogs = 0;
         p.on('dialog', async dialog => { dialogs++; await dialog.dismiss(); });
         await p.locator('#ws-back').click();
         await expect(p.locator('#wp-search')).toBeVisible();
         assert.equal(dialogs, 0);
       } else {
         await expect(p.locator('[data-tab=public]')).toHaveClass(/wp-unsaved/);
         await expect(p.locator('#wp-public-state')).toContainText('input is still unsaved');
         await expect(p.locator('#wp-complete')).toBeEnabled();
         const from = p.url();
         const leaveDialog = p.waitForEvent('dialog');
         const leaveClick = p.locator('#ws-back').click();
         await (await leaveDialog).dismiss(); await leaveClick;
         assert.equal(p.url(), from);
         await expect(p.locator('#wp-name')).toHaveValue('Kept locally');
         // Saving the recovered public input must leave private changes dirty.
         await p.locator('[data-tab=notes]').click();
         await expect(p.locator('#wp-notes')).toBeEnabled();
         await p.locator('#wp-notes').fill('Private input remains unsaved');
         await p.locator('[data-tab=public]').click();
         const write = p.waitForRequest(r => r.url().endsWith('/api/me/personas/save'));
         if (role === 'user') p.once('dialog', dialog => dialog.accept());
         await p.locator('#wp-complete').click();
         const payload = (await write).postDataJSON();
         assert.equal(payload.baseRevisionId, foreign.revisionId);
         assert.equal(payload.expectedSubmittedRevisionId, role === 'user' ? foreign.revisionId : null);
         await expect(p.locator('#wp-public-state')).toContainText(role === 'user' ? 'saved and submitted' : 'saved and published');
         await expect(p.locator('[data-tab=public]')).not.toHaveClass(/wp-unsaved/);
         await expect(p.locator('[data-tab=notes]')).toHaveClass(/wp-unsaved/);
         const result = (await myPersonas(f.db, account)).find(persona => persona.id === target.id)!;
         assert.equal(result.draft.en.name, 'Kept locally');
         assert.equal(role === 'user' ? result.submitted_revision_id : result.published_revision_id, result.head_revision_id);
         await p.locator('[data-tab=notes]').click();
         await expect(p.locator('#wp-notes')).toHaveValue('Private input remains unsaved');
       }
     } finally { await ctx.close(); }
   });
 }
 assert.deepEqual(errors,[]);
} finally {if(browser)await browser.close();for(const child of children.reverse())await stop(child);await f.cleanup();}
});
