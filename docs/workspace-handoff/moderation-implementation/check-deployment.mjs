import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parse} from 'dotenv';
import {chromium} from 'playwright';
const base='https://plotstay.xingwu.dev',local='http://127.0.0.1:4321',results=[],errors=[];
const out=new URL('deployment-20261018/',import.meta.url);await mkdir(out,{recursive:true});
for(const path of ['/zh/workspace?view=moderation','/en/workspace?view=moderation','/zh/workspace?view=site','/en/workspace?view=site','/api/moderation-workspace/scopes','/api/moderation-workspace/queue?kind=reviews','/api/moderation-workspace/accounts','/zh/account?view=moderation','/en/admin','/_design/moderation/index.html','/robots.txt']){
 const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,path==='/robots.txt'?200:401);assert.match(r.headers.get('x-robots-tag'),/noindex.*nofollow.*noarchive/);assert.match(r.headers.get('cache-control'),/no-store/);
 if(r.status===401)assert.match(r.headers.get('www-authenticate'),/Basic/);else assert.match(await r.text(),/Disallow: \//);
 results.push({scope:'public gate',path,status:r.status});
}
for(const path of ['/api/moderation-workspace/scopes','/api/moderation-workspace/queue?kind=reviews']){
 const r=await fetch(local+path);assert.equal(r.status,403);assert.equal(r.headers.get('www-authenticate'),null);assert.equal((await r.json()).error.code,'SESSION_REQUIRED');results.push({scope:'signed-out API',path,status:403});
}
const env=parse(await readFile('.env','utf8'));
const login=await fetch('http://127.0.0.1:4310/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD})});
assert.equal(login.status,200,'Existing administrator login');
const cookie=login.headers.getSetCookie().find(c=>c.startsWith('plotstay_session='));assert.ok(cookie);
const value=cookie.split(';')[0].slice('plotstay_session='.length);let browser;
try{
 browser=await chromium.launch({args:['--no-sandbox']});
 const context=await browser.newContext();await context.addCookies([{name:'plotstay_session',value,domain:'127.0.0.1',path:'/api',httpOnly:true,secure:false,sameSite:'Strict'}]);
 const get=async path=>{const r=await context.request.get(local+path);assert.equal(r.status(),200,path);const body=await r.json();results.push({scope:'authenticated API',path,status:200});return body;};
 const scope=await get('/api/moderation-workspace/scopes');assert.equal(scope.actor.siteRole,'admin');
 const queues={};
 for(const kind of ['reviews','replies','profiles']){const q=await get('/api/moderation-workspace/queue?kind='+kind+'&status=all&locale=en');assert(Number.isInteger(q.total));assert(q.items.length<=q.pageSize);queues[kind]=q;}
 if(scope.worlds.length)await get('/api/moderation-workspace/providers/'+scope.worlds[0].id);
 const page=await context.newPage();const assets=new Set();
 page.on('pageerror',e=>errors.push({type:'javascript',message:e.message}));
 page.on('response',r=>{if(r.status()>=400)errors.push({type:'http',status:r.status(),path:new URL(r.url()).pathname});});
 await page.route('**/*',async route=>{if(route.request().method()!=='GET'){errors.push({type:'unexpected write',method:route.request().method()});await route.abort();}else await route.continue();});
 const root=page.locator('#moderation-workspace');
 for(const [lang,width]of [['zh',1440],['en',390]]){
  await page.setViewportSize({width,height:900});
  for(const [view,tab] of [['moderation','reviews'],['moderation','replies'],['site','profiles'],['site','accounts'],['site','bindings']]){
   await page.goto(local+`/${lang}/workspace?view=${view}&tab=${tab}`);
   await root.locator('.tabs').waitFor();
   assert.equal(await root.locator('.tabs [aria-current=page]').getAttribute('data-value'),tab);
   assert.equal(await root.locator('.tabs button').count(),view==='site'?3:2);
   if(tab==='accounts')await root.locator('#moderation-create-account').waitFor();
   if(tab==='bindings'){
    await root.locator('[data-select=binding-world]').waitFor();
    if(scope.worlds.length){
     await root.locator('[data-select=binding-world]').selectOption(scope.worlds[0].id);
     await root.locator('.tabs').waitFor();
     const options=root.locator('[data-select=entry] option');
     if(await options.count()>1){const id=await options.nth(1).getAttribute('value');await root.locator('[data-select=entry]').selectOption(id);await root.locator('.binding-summary').waitFor();}
    }
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${lang}/${tab} overflow`);
   await page.screenshot({path:new URL(`${tab}-${lang}-${width}.png`,out).pathname,fullPage:true});
   results.push({scope:'deployed authenticated browser',lang,width,view,tab});
   for(const src of await page.locator('script[src],link[rel=stylesheet]').evaluateAll(es=>es.map(e=>e.getAttribute('src')||e.getAttribute('href')).filter(Boolean)))assets.add(src);
  }
 }
 for(const kind of ['reviews','replies','profiles']){
  const first=queues[kind].items[0];if(!first){results.push({scope:'detail smoke',kind,skipped:'No existing records; no test data created.'});continue;}
  const id=kind==='profiles'?first.revision_id:first.id;assert(id);
  await page.goto(local+`/zh/workspace?view=${kind==='profiles'?'site':'moderation'}&tab=${kind}&status=all&detail=${id}`);
  await root.locator(kind==='profiles'?'.profile-compare':'.context-strip').waitFor();
  await page.screenshot({path:new URL(`detail-${kind}.png`,out).pathname,fullPage:true});results.push({scope:'deployed existing detail',kind});
 }
 for(const path of ['/zh','/en','/zh/account','/en/admin','/zh/workspace?view=personas','/en/workspace?view=reviews','/zh/workspace?view=works','/en/workspace?view=create','/api/health']){
  const r=await context.request.get(local+path);assert.equal(r.status(),200);assert.match(r.headers()['x-robots-tag'],/noindex/);assert.match(r.headers()['cache-control'],/no-store/);results.push({scope:'existing route smoke',path,status:200});
 }
 for(const path of assets){const r=await fetch(new URL(path,base));assert.equal(r.status,401);assert.match(r.headers.get('x-robots-tag'),/noindex.*nofollow.*noarchive/);assert.match(r.headers.get('cache-control'),/no-store/);results.push({scope:'asset gate',path,status:401});}
 assert.deepEqual(errors,[]);
}finally{
 await browser?.close();await fetch('http://127.0.0.1:4310/api/auth/logout',{method:'POST',headers:{Origin:base,Cookie:'plotstay_session='+value}});
}
await writeFile(new URL('checks.json',out),JSON.stringify({checkedAt:new Date().toISOString(),sourceCommit:'216d64cfd3a0a26c3a9a3b34ac6f752f5543de66',results,errors,scope:'Public anonymous gate checks; authenticated read-only browser on the same deployed service via loopback. Login/logout session writes only. No live business writes or migrations. Public authenticated interaction not verified.'},null,2)+'\n');
console.log(JSON.stringify({passed:results.length,errors}));
