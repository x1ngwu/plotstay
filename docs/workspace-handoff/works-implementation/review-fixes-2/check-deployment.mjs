import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parse} from 'dotenv';
import {chromium,expect} from '@playwright/test';
const base='https://plotstay.xingwu.dev',local='http://127.0.0.1:4321',results=[];
for(const path of ['/zh/workspace?view=works','/en/workspace?view=create','/api/me/works','/api/me/works/save','/api/me/works/create-options','/api/me/work-preview/en/test','/zh/account','/en/admin','/robots.txt']){
 const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});assert.equal(r.status,path==='/robots.txt'?200:401);assert.match(r.headers.get('x-robots-tag'),/noindex.*nofollow.*noarchive/);assert.match(r.headers.get('cache-control'),/no-store/);if(r.status===401)assert.match(r.headers.get('www-authenticate'),/Basic/);else assert.match(await r.text(),/Disallow: \//);results.push({scope:'public gate',path,status:r.status});
}
const env=parse(await readFile('.env','utf8'));
const login=await fetch('http://127.0.0.1:4310/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD})});assert.equal(login.status,200,'Existing demo admin login');
const cookie=login.headers.getSetCookie().find(c=>c.startsWith('plotstay_session='));assert.ok(cookie);const value=cookie.split(';')[0].slice('plotstay_session='.length);
const browser=await chromium.launch();const errors=[];
try{
 const context=await browser.newContext();await context.addCookies([{name:'plotstay_session',value,domain:'127.0.0.1',path:'/api',httpOnly:true,secure:false,sameSite:'Strict'}]);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>assert.equal(r.method(),'GET','Live smoke must not save business data.'));
 await mkdir(new URL('screenshots/',import.meta.url),{recursive:true});
 for(const [lang,width] of [['zh',1440],['en',390]]){
  await page.setViewportSize({width,height:900});
  for(const view of ['works','create']){
   await page.goto(local+`/${lang}/workspace?view=${view}`);
   await expect(page.locator(view==='works'?'#result-count':'#create-form')).toBeVisible();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:new URL(`screenshots/deployed-${view}-${lang}-${width}.png`,import.meta.url).pathname,fullPage:true});results.push({scope:'deployed authenticated read-only browser',lang,width,view});
  }
 }
 for(const path of ['/zh','/en','/zh/account','/en/admin','/zh/workspace?view=personas','/en/workspace?view=reviews']){const r=await context.request.get(local+path);assert.equal(r.status(),200);assert.match(r.headers()['x-robots-tag'],/noindex/);results.push({scope:'old entry / public page smoke',path,status:200});}
 for(const path of ['/api/me/works','/api/me/works/create-options']){const r=await context.request.get(local+path);assert.equal(r.status(),200);const b=await r.json();if(path==='/api/me/works'){assert.equal(b.total,21);assert.ok(b.items.every(i=>i.state!=='repair'));}results.push({scope:'deployed authenticated API',path,status:200});}
 const assets=await page.locator('script[src],link[rel=stylesheet]').evaluateAll(es=>es.map(e=>e.getAttribute('src')||e.getAttribute('href')).filter(Boolean));for(const path of assets){const r=await fetch(base+path);assert.equal(r.status,401);assert.match(r.headers.get('x-robots-tag'),/noindex.*nofollow.*noarchive/);results.push({scope:'asset gate',path,status:401});}
 assert.deepEqual(errors,[]);
}finally{
 await browser.close();
 await fetch('http://127.0.0.1:4310/api/auth/logout',{method:'POST',headers:{Origin:base,Cookie:'plotstay_session='+value}});
}
await writeFile(new URL('deployment-check.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),results,errors,scope:'Public Basic Auth/header checks; authenticated browser uses the same deployed service through its loopback listener. No live content saves. Ordinary-author writes verified only in isolated database.'},null,2)+'\n');console.log(JSON.stringify({passed:results.length,errors}));
