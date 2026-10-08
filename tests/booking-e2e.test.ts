import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, expect, type Page } from '@playwright/test';
import { detailFixture } from './detail-fixture.ts';
import { unusedPort, waitFor, stop } from './runtime.ts';
import { editContentSchema } from '@plotstay/contracts';
import { editContent, getPublished, unpublishContent, restorePublication } from '@plotstay/domain';
const future=(n:number)=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);

test('phase 5 complete booking browser flows', {timeout:240000}, async t=>{
 const f=await detailFixture();t.after(f.cleanup);
 const fixed=f.entries[1]!;
 const current=(await getPublished(f.db,'en',{id:fixed.id}))!;
 const update=await editContent(f.db,f.data.owner,fixed.id,editContentSchema.parse({baseRevisionId:fixed.revisionId,sourceLocale:'en',text:current.text,translations:fixed.input.translations,attributes:{...current.attributes,experience:{sessions:[{startsAt:future(7)+'T10:30:00Z',endsAt:future(7)+'T12:00:00Z'},{startsAt:future(7)+'T14:00:00Z',endsAt:future(7)+'T15:30:00Z'}]}}}));await f.publish(update);
 const apiPort=await unusedPort(),webPort=await unusedPort(),apiUrl=`http://127.0.0.1:${apiPort}`,webUrl=`http://127.0.0.1:${webPort}`;
 const env={...process.env,PGOPTIONS:f.options,NODE_ENV:'production',COOKIE_SECURE:'false',SITE_INDEXABLE:'false',API_PORT:String(apiPort),API_HOST:'127.0.0.1',HOST:'127.0.0.1',PORT:String(webPort),WEB_ORIGIN:webUrl,API_INTERNAL_URL:apiUrl};
 const launch=(entry:string)=>{const child=spawn(process.execPath,[entry],{env,stdio:['ignore','pipe','pipe']});let logs='';child.stdout!.on('data',d=>logs+=d);child.stderr!.on('data',d=>logs+=d);t.after(()=>stop(child));return {child,logs:()=>logs};};
 const api=launch('apps/api/dist/server.mjs');await waitFor(apiUrl+'/api/health',api.child,api.logs);
 const web=launch('apps/web/server.mjs');await waitFor(webUrl+'/en',web.child,web.logs);
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const context=await browser.newContext({acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});t.after(()=>context.close());
 const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const dir='test-results/phase5';await mkdir(dir,{recursive:true});
 const route=(kind:string,locale='en')=>`/${locale}/worlds/lathe-worlds/${kind==='stay'?'stays':kind==='experience'?'experiences':'services'}/detail-${kind}`;
 const query=(kind:string)=>new URLSearchParams({from:'results',view:'results',type:kind==='stay'?'stays':kind==='experience'?'experiences':'services',start:future(7),guests:'2',...(kind==='stay'?{end:future(10),rooms:'2'}:kind==='service'?{quantity:'3',time:'afternoon'}:{})});
 const count=async()=>Number((await f.db.query('SELECT count(*) FROM bookings')).rows[0].count);
 async function start(kind='stay',locale='en',p=page){await p.goto(webUrl+route(kind,locale)+'?'+query(kind));await p.locator('[data-booking-entry]').click();await expect(p.locator('[data-quote]')).toBeEnabled();}
 async function quote(p=page){await p.locator('[data-quote]').click();await expect(p.locator('[data-review]')).toBeVisible();await p.locator('[data-consent]').check();await expect(p.locator('[data-confirm]')).toBeEnabled();}
 async function finish(p=page){await p.locator('[data-confirm]').click();await p.waitForURL(/\/receipts\//);await expect(p.locator('[data-receipt-content]')).toBeVisible();}
 let lastReceipt='';
 await t.test('three types in both languages preserve selections, persist, refresh and download valid PNGs at desktop and mobile widths',async()=>{
  const before=await count();
  for(const locale of ['en','zh'])for(const width of [1440,390])for(const kind of ['stay','experience','service']){
   await page.setViewportSize({width,height:1000});await start(kind,locale);
   await expect(page.locator('[name=guests]')).toHaveValue('2');
   if(kind==='stay'){await expect(page.locator('[name=start]')).toHaveValue(future(7));await expect(page.locator('[name=end]')).toHaveValue(future(10));await expect(page.locator('[name=rooms]')).toHaveValue('2');}
   if(kind==='experience')await expect(page.locator('[name=startsAt]')).toHaveValue(future(7)+'T10:30:00Z');
   if(kind==='service'){await expect(page.locator('[name=quantity]')).toHaveValue('3');await expect(page.locator('[name=time]')).toHaveValue('14:00');}
   await page.reload();await expect(page.locator('[data-quote]')).toBeEnabled();
   await quote();await expect(page.locator('[data-ticket-total]')).toContainText(kind==='stay'?'432':kind==='experience'?'144':'216');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`${dir}/review-${kind}-${locale}-${width}.png`,fullPage:true});
   await finish();lastReceipt=page.url();const id=lastReceipt.split('/').at(-1)!;
   const saved=(await f.db.query('SELECT * FROM bookings WHERE id=$1',[id])).rows[0];assert.ok(saved.guest_id);assert.equal(saved.locale,locale==='zh'?'zh-CN':'en');assert.equal(saved.snapshot.trip.guests,2);
   assert.equal(saved.snapshot.total,kind==='stay'?432:kind==='experience'?144:216);
   await page.reload();await expect(page.locator('[data-receipt-content]')).toBeVisible();
   const downloadEvent=page.waitForEvent('download');await page.locator('[data-download]').click();const download=await downloadEvent;
   assert.equal(await download.failure(),null);assert.match(download.suggestedFilename(),new RegExp(`plotstay-${kind}-.*\\.png`));
   const target=`${dir}/ticket-${kind}-${locale}-${width}.png`;await download.saveAs(target);const png=await readFile(target);
   assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),1600);assert.ok(png.readUInt32BE(20)>=1800);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${dir}/receipt-${kind}-${locale}-${width}.png`,fullPage:true});
  }
  assert.equal(await count(),before+12);
 });
 await t.test('language switching preserves historical issue language; copy links, revisit and deliberate new bookings work',async()=>{
  await page.goto(lastReceipt.replace('/zh/','/en/'));await expect(page.locator('[data-receipt-content]')).toBeVisible();await expect(page.locator('[data-ticket-meta]')).toContainText('zh-CN');
  await page.locator('[data-copy-detail]').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),webUrl+route('service'));
  await page.locator('[data-copy-receipt]').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),page.url());
  const before=await count();await page.locator('[data-book-again]').click();await expect(page.locator('[data-quote]')).toBeEnabled();
  // A daily-session repeat preserves the exact date/time rather than silently defaulting.
  await expect(page.locator('[name=start]')).toHaveValue(future(7));await expect(page.locator('[name=time]')).toHaveValue('14:00');
  await quote();await finish();assert.equal(await count(),before+1);
  const issued=page.url();await page.locator('[data-listing-link]').click();await expect(page.locator('article[data-content-id]')).toBeVisible();
  await expect(page.locator('[data-recent-booking]')).toBeVisible();await page.locator('[data-recent-booking]').click();await page.waitForURL(issued);await expect(page.locator('[data-receipt-content]')).toBeVisible();
 });
 await t.test('a second browser cannot access a receipt by URL and receives no private snapshot',async()=>{
  const stranger=await browser.newContext();try{const p=await stranger.newPage();await p.goto(lastReceipt);await expect(p.locator('[data-booking-message]')).toContainText('Cookie');await expect(p.locator('[data-receipt-content]')).toBeHidden();assert.equal(await p.locator('[data-ticket-title]').textContent(),'');assert.equal((await stranger.cookies()).filter(c=>c.name==='plotstay_guest').length,0);}finally{await stranger.close();}
 });
 await t.test('a committed request with a lost response recovers on refresh without a duplicate',async()=>{
  await start();await quote();const before=await count();
  await page.route('**/api/bookings',async route=>{await route.fetch();await route.abort('failed');});
  await page.locator('[data-confirm]').click();await expect(page.locator('[data-retry]')).toBeVisible();assert.equal(await count(),before+1);
  await page.unroute('**/api/bookings');await page.reload();await page.waitForURL(/\/receipts\//);await expect(page.locator('[data-receipt-content]')).toBeVisible();assert.equal(await count(),before+1);
 });
 await t.test('a request interrupted before reaching the backend keeps the same key across reload and retry',async()=>{
  await start('service');await quote();const before=await count();const attempt=new URL(page.url()).searchParams.get('attempt');
  await page.route('**/api/bookings',route=>route.abort('failed'));await page.locator('[data-confirm]').click();await expect(page.locator('[data-retry]')).toBeVisible();assert.equal(await count(),before);
  await page.reload();await expect(page.locator('[data-retry]')).toBeVisible();await expect(page.locator('[name=guests]')).toBeDisabled();
  await page.unroute('**/api/bookings');await page.locator('[data-retry]').click();await page.waitForURL(/\/receipts\//);await expect(page.locator('[data-receipt-content]')).toBeVisible();assert.equal(await count(),before+1);
  const row=(await f.db.query('SELECT idempotency_key FROM bookings WHERE id=$1',[page.url().split('/').at(-1)])).rows[0];assert.equal(row.idempotency_key,attempt);
 });
 await t.test('expired dates and unmatched preferences show actionable states in both languages',async()=>{
  for(const locale of ['en','zh']){
   await start('stay',locale);await page.locator('[name=start]').fill(future(-2));await page.locator('[data-trip-form]').evaluate((el:HTMLFormElement)=>el.noValidate=true);
   await page.locator('[data-quote]').click();await expect(page.locator('[data-booking-message]')).toContainText(locale==='en'?'no longer valid':'失效');await expect(page.locator('[data-review]')).toBeHidden();
   await page.goto(webUrl+`/${locale}/booking/${fixed.id}?start=${future(9)}&guests=2`);await expect(page.locator('[data-preference-note]')).toBeVisible();await expect(page.locator('[name=startsAt]')).toHaveValue('');
  }
 });
 await t.test('withdrawal after review prevents creation; historical receipt still loads',async()=>{
  await start();await quote();const id=f.entries[0]!.id,old=(await getPublished(f.db,'en',{id}))!,before=await count();
  await unpublishContent(f.db,f.data.owner,id,false,'Browser withdrawal test');await page.locator('[data-confirm]').click();await expect(page.locator('[data-booking-message]')).toContainText('withdrawn');assert.equal(await count(),before);
  const response=await page.goto(webUrl+`/en/booking/${id}`);assert.equal(response!.status(),404);await expect(page.locator('h1')).toContainText('not available');
  await restorePublication(f.db,f.data.owner,id,old.publicationId);
 });
 await t.test('download and clipboard failures leave the saved receipt intact and offer recovery',async()=>{
  await page.goto(lastReceipt.replace('/zh/','/en/'));await expect(page.locator('[data-receipt-content]')).toBeVisible();const before=await count();
  await page.evaluate("HTMLCanvasElement.prototype.toBlob = function(callback) { callback(null); }; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async function() { throw new Error('Denied'); } } });");
  await page.locator('[data-download]').click();await expect(page.locator('[data-booking-message]')).toContainText('download failed');await expect(page.locator('[data-download]')).toBeEnabled();
  await page.locator('[data-copy-detail]').click();await expect(page.locator('[data-copy-value]')).toHaveValue(webUrl+route('service'));assert.equal(await count(),before);
 });
 await t.test('320 and 768 pixel layouts remain usable and no client exceptions occur',async()=>{
  for(const width of [320,768]){await page.setViewportSize({width,height:900});await start('service','zh');await quote();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.goto(lastReceipt);await expect(page.locator('[data-receipt-content]')).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${dir}/receipt-extra-${width}.png`,fullPage:true});}
  assert.deepEqual(errors,[]);
 });
});
