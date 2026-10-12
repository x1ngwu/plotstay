import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {prototypeServer} from './serve.mjs';
const here=fileURLToPath(new URL('.',import.meta.url));
const report={date:new Date().toISOString(),scope:'Isolated visual prototype, not real data acceptance',checks:[],screens:[]};
const server=prototypeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
const check=name=>{report.checks.push(name);console.log('PASS',name);};
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 await page.goto(origin);
 for(const width of [1440,390])for(const lang of ['zh','en'])for(const scenario of ['manager','author','empty','many','error','loading','planned']){
  await page.evaluate(()=>sessionStorage.clear());await page.setViewportSize({width,height:1000});await page.goto(`${origin}/?lang=${lang}&case=${scenario}`);await expect(page.locator('h1')).toBeVisible();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${lang}/${scenario}/${width} overflows`);
  if(['manager','author','empty','error'].includes(scenario)){const name=`${lang}-${scenario}-${width}.png`;await page.screenshot({path:here+'screenshots/'+name,fullPage:true});report.screens.push(name);}
  await page.locator('[data-scope=assisted]').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(scenario==='manager'){const name=`${lang}-assisted-${width}.png`;await page.screenshot({path:here+'screenshots/'+name,fullPage:true});report.screens.push(name);}
 }
 check('28 bilingual desktop/mobile scenario renders and assisted tabs without document overflow');
 await page.goto(origin+'/?lang=zh&case=manager');await page.locator('[data-scope=mine]').click();await page.locator('[data-scope=mine]').press('ArrowRight');await expect(page.locator('[data-scope=assisted]')).toBeFocused();await expect(page.locator('[data-scope=assisted]')).toHaveAttribute('aria-selected','true');
 await page.locator('[data-item=assist-long] .subject').click();await expect(page.locator('h1')).toContainText('沿着旧航标');await page.locator('#draft').fill('未保存的输入');page.once('dialog',d=>d.dismiss());await page.locator('.back').click();await expect(page.locator('#draft')).toHaveValue('未保存的输入');
 page.once('dialog',d=>d.accept());await page.locator('.back').click();await expect(page.locator('[data-scope=assisted]')).toHaveAttribute('aria-selected','true');await expect(page.locator('[data-item=assist-long] .subject')).toBeFocused();
 check('Keyboard tabs, target navigation, unsaved-input guard and return to original tab/item');
 await page.locator('[data-item=reply] .subject').click();await page.locator('.back').click();await expect(page.locator('.attention [data-item=reply]')).toHaveCount(1);await page.locator('[data-item=reply] .subject').click();await page.locator('[data-transition=draft]').click();await page.locator('.back').click();await expect(page.locator('.attention [data-item=reply]')).toHaveCount(0);await page.locator('[data-scope=mine]').click();await expect(page.locator('#scope-panel [data-item=reply]')).toHaveCount(1);
 await page.locator('[data-item=reply] .subject').click();await page.locator('[data-transition=submitted]').click();await page.locator('.back').click();await expect(page.locator('[data-item=reply]')).toHaveCount(0);await expect(page.locator('.progress').first()).toContainText('已提交审核');
 check('Reading keeps task; reply save moves to continue; submission moves to progress');
 await page.goto(origin+'/?lang=zh&case=many');await page.locator('[data-scope=mine]').click();await page.locator('a[href="#all/mine/project"]').click();assert((await page.locator('[data-item]').count())>2);await expect(page.locator('[data-item=assist-long]')).toHaveCount(0);check('View all keeps group and scope, reveals entries beyond summary');
 await page.goto(origin+'/?lang=zh&case=error');await expect(page.locator('[data-retry]')).toBeVisible();await page.locator('[data-scope=mine]').click();await expect(page.locator('[data-item=wanderer]')).toBeVisible();await page.locator('[data-retry]').click();await expect(page.locator('.world')).toHaveCount(2);await page.locator('[data-pin=harbour]').click();await expect(page.locator('[data-pin=harbour]')).toHaveAttribute('aria-pressed','true');await page.locator('a[href="#world/harbour/visit"]').click();await expect(page.getByRole('heading',{name:'世界公开页面'})).toBeVisible();await page.locator('.back').click();await page.locator('a[href="#world/harbour/manage"]').click();await expect(page.getByRole('heading',{name:'世界管理',exact:true})).toBeVisible();check('Partial failure retries independently; pins, visit and management have distinct behavior');
 await page.goto(origin+'/?lang=en&case=author');await expect(page.locator('[data-item=starport]')).toHaveCount(0);await expect(page.locator('[data-item=queue]')).toHaveCount(0);await expect(page.locator('.world')).toHaveCount(0);await page.goto(origin+'/?lang=en&case=planned');await expect(page.locator('.planning')).toContainText('not available yet');check('Author examples exclude management; future project capability explicitly marked planned');
 assert.deepEqual(errors,[]);assert(requests.every(r=>r.method==='GET'&&r.url.startsWith(origin)&&!r.url.includes('/api/')));check('No browser errors, external requests or application API access');
 await writeFile(here+'verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({checks:report.checks.length,screens:report.screens.length}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
