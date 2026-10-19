import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
const origin=process.env.COPY_PREVIEW_URL||'http://127.0.0.1:4398';
const published=process.argv.includes('--published');
const out='.runtime/copy-20261019';mkdirSync(out,{recursive:true});
const checks=[],errors=[];const browser=await chromium.launch({headless:true});
const record=(name)=>checks.push(name);
const browse=async(locale,type='all')=>{const r=await fetch(`http://127.0.0.1:4310/api/browse?locale=${locale}&world=lathe-worlds&type=${type}&view=results`);assert.ok(r.ok);return r.json();};
try{
 for(const [prefix,locale]of [['zh','zh-CN'],['en','en']]){
  const context=await browser.newContext({viewport:{width:prefix==='zh'?1440:390,height:1000},acceptDownloads:true});
  // All browser POSTs are synthetic; public reads use the running API. No test booking or guest is written.
  await context.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/api/guest')return route.fulfill({json:{guest:{id:'00000000-0000-4000-8000-000000000001'}}});
   if(url.pathname.startsWith('/api/bookings/attempts/'))return route.fulfill({json:{receipt:null}});
   if(req.method()!=='GET'){errors.push('Unexpected write '+url.pathname);return route.abort();}
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/${prefix}`);await page.locator('.hero').waitFor();
  assert.ok((await page.locator('.isi-credit').innerText()).includes(prefix==='zh'?'伊斯多鲁斯':'Isidorrus'));
  assert.equal(await page.locator('[name=q]').getAttribute('placeholder'),prefix==='zh'?'搜索名称、地点或标签':'Search names, places or tags');
  if(published) assert.equal(await page.locator('.hero h1').innerText(),prefix==='zh'?'万千齿轮流转，总有一处供您停留。':"There's a place for you in the Machine.");
  record(prefix+' home');await page.screenshot({path:`${out}/home-${prefix}.png`,fullPage:true});
  await page.goto(`${origin}/${prefix}?view=results&q=copy-verification-no-match-024681`);
  assert.ok((await page.locator('.panel').innerText()).includes(prefix==='zh'?'神圣誓约':'sacred vows'));record(prefix+' empty search');
  await page.goto(`${origin}/${prefix}?view=results`);assert.equal(await page.locator('h1').innerText(),prefix==='zh'?'万千奇观，妥善归档。':'Wonders, properly catalogued.');record(prefix+' directory');
  for(const [kind,type,heading] of [['stay','stays',prefix==='zh'?'您的住处，详述于此':'Your quarters, in detail'],['experience','experiences',prefix==='zh'?'此行，您将体验':'What awaits you'],['service','services',prefix==='zh'?'可为您安排的服务':'What can be arranged']]){
   const data=await browse(locale,type),content=data.listing.contents.find(c=>c.kind===kind);assert.ok(content,kind);
   await page.goto(`${origin}/${prefix}/worlds/lathe-worlds/${type}/${content.slug}`);
   assert.ok((await page.locator('main').innerText()).includes(heading),`${prefix} ${kind} ${heading}`);
   assert.ok((await page.locator('main').innerText()).includes(prefix==='zh'?'旅客笔记':'Visitor notes'));record(prefix+' '+kind+' detail');
   await page.screenshot({path:`${out}/${kind}-${prefix}.png`,fullPage:true});
   await page.goto(`${origin}/${prefix}/booking/${content.id}`);
   await page.locator('[data-trip-fields]').waitFor();
   assert.equal(await page.locator('h1').innerText(),prefix==='zh'?'一段值得记录的旅程。':'A journey worth recording.');
   assert.ok((await page.locator('main').innerText()).includes(prefix==='zh'?'故事之外':'OUTSIDE THE STORY'));record(prefix+' '+kind+' booking');
  }
  // Synthetic snapshot is used only in intercepted responses, never persisted.
  const stay=(await browse(locale,'stays')).listing.contents[0];
  const id='00000000-0000-4000-8000-000000000099';
  const snapshot={version:1,contentId:stay.id,publicationId:stay.publicationId,contentSlug:stay.slug,kind:'stay',title:stay.text.title,summary:stay.text.summary,worldId:stay.worldId,worldSlug:'lathe-worlds',worldName:prefix==='zh'?'拉斯世界':'Lathe Worlds',placeId:stay.placeId,placeName:stay.placeName,location:stay.placeName||'Texo',currencyName:'Thrones',amount:100,unit:'night',total:200,multiplier:2,nights:2,fees:0,trip:{kind:'stay',start:'2026-11-10',end:'2026-11-12',guests:1,rooms:1},endsAt:null,timeZone:'UTC',sessionSource:null,locale,contentLocale:locale,languageTag:prefix==='zh'?'zh-Hans':'en',personaName:'Synthetic traveller',cancellation:''};
  const receipt={id,createdAt:'2026-10-19T12:00:00Z',locale,snapshot};
  await page.route('**/api/bookings/quote',r=>r.fulfill({json:{snapshot,quoteHash:'a'.repeat(64)}}));
  let submissions=[];
  await page.route('**/api/bookings',async r=>{submissions.push(r.request().postDataJSON()); if(submissions.length===1)return r.abort('failed');return r.fulfill({json:{receipt}});});
  await page.route('**/api/bookings/'+id,r=>r.fulfill({json:{receipt}}));
  await page.goto(`${origin}/${prefix}/booking/${stay.id}`);
  await page.locator('[name=start]').fill('2026-11-10');await page.locator('[name=end]').fill('2026-11-12');await page.locator('[data-quote]').click();
  await page.locator('[data-review]').waitFor({state:'visible'});
  assert.ok((await page.locator('[data-review]').innerText()).includes(prefix==='zh'?'各项细节，悉数核对。':'Every detail accounted for.'));
  await page.locator('[data-consent]').check();await page.locator('[data-confirm]').click();await page.locator('[data-retry]').waitFor({state:'visible'});
  assert.ok((await page.locator('[data-booking-message]').innerText()).includes(prefix==='zh'?'不会重复创建':'without creating a duplicate'));
  await page.locator('[data-retry]').click();await page.waitForURL('**/receipts/'+id);
  await page.locator('[data-isi-signature]').waitFor({state:'visible'});
  assert.deepEqual(submissions[0],submissions[1]);record(prefix+' retry preserves original request');
  assert.ok((await page.locator('[data-isi-signature]').innerText()).includes(prefix==='zh'?'Texo 接迎空间站':'Excipio Station Texo'));
  assert.equal(await page.locator('[data-receipt-heading]').innerText(),prefix==='zh'?'您的预订已确认。':'Your reservation is confirmed.');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Synthetic clipboard refusal')}}}));
  await page.locator('[data-copy-receipt]').click();await page.locator('[data-copy-fallback]').waitFor({state:'visible'});
  assert.ok((await page.locator('[data-booking-message]').innerText()).includes(prefix==='zh'?'手动复制':'manually'));record(prefix+' clipboard fallback');
  const downloaded=page.waitForEvent('download');await page.locator('[data-download]').click();const download=await downloaded;await download.saveAs(`${out}/document-${prefix}.png`);record(prefix+' document image export');
  await page.screenshot({path:`${out}/receipt-${prefix}.png`,fullPage:true});
  await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=function(callback){callback(null)};});await page.locator('[data-download]').click();
  await page.waitForFunction(()=>document.querySelector('[data-booking-message]').textContent.includes('下载失败')||document.querySelector('[data-booking-message]').textContent.includes('could not be downloaded'));
  record(prefix+' image failure retains booking');
  // Other worlds must not acquire Isi's signature or statement.
  snapshot.worldSlug='another-world';await page.reload();await page.locator('[data-receipt-content]').waitFor({state:'visible'});assert.ok(await page.locator('[data-isi-signature]').isHidden());assert.ok(await page.locator('[data-retention-aside]').isHidden());record(prefix+' other-world isolation');
  await page.route('**/api/bookings/'+id,r=>r.fulfill({status:404,json:{error:{code:'NOT_FOUND'}}}));await page.reload();await page.locator('[data-load-retry]').waitFor({state:'visible'});
  assert.ok((await page.locator('[data-booking-message]').innerText()).includes(prefix==='zh'?'原有 Cookie':'original cookie'));record(prefix+' inaccessible document');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile overflow');
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:checks.length,passed:checks,errors},null,2));
 writeFileSync(`${out}/browser-${published?'published':'preview'}.json`,JSON.stringify({origin,checks,errors},null,2));
}finally{await browser.close();}
