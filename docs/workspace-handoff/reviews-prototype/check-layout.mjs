import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {prototypeServer} from './serve.mjs';
const server=prototypeServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1672,height:941}});
const results=[];
const pages=[['01-my-reviews','view=reviews'],['02-received-reviews','view=replies'],['03-review-detail-editor','view=reviews&id=r2&mode=edit'],['04-reply-detail-editor','view=replies&id=s4&mode=edit']];
try {
 for(const [name,q] of pages){
  await page.goto(origin+'/?lang=zh&'+q);
  if(name.startsWith('03'))await page.locator('.rv-optional summary').click();
  await page.evaluate(()=>scrollTo(0,0));
  const metrics=await page.evaluate(()=>{
   const rect=s=>{const el=document.querySelector(s);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
   return {filterY:['#world','#kind','#status','#search','#sort'].map(s=>rect(s)?.y),cards:[...document.querySelectorAll('.rv-interaction-card')].map(e=>({y:e.getBoundingClientRect().y,height:e.getBoundingClientRect().height})),main:rect('.rv-editor-main'),aside:rect('.rv-editor-aside'),reading:[...document.querySelectorAll('.rv-exchange .rv-prose')].map(e=>({visible:!!e.getClientRects().length,text:e.textContent})),font:getComputedStyle(document.querySelector('h1')).fontFamily};
  });
  await page.screenshot({path:new URL(`screenshots/reference-${name}-zh-1672-viewport.png`,import.meta.url).pathname});
  if(name.startsWith('01')||name.startsWith('02')){
   expect(new Set(metrics.filterY).size).toBe(1);
   expect(metrics.cards[0].y).toBeLessThan(400);
   expect(metrics.cards[0].height).toBeLessThan(330);
  } else {
   expect(metrics.aside.x).toBeGreaterThan(metrics.main.x+metrics.main.width);
   expect(metrics.reading.length).toBe(2);
   expect(metrics.reading.every(r=>r.visible)).toBe(true);
   await expect(page.locator('.rv-page-actions [data-action=submit]')).toBeVisible();
  }
  await page.screenshot({path:new URL(`screenshots/reference-${name}-zh-1672-viewport.png`,import.meta.url).pathname});
  results.push({name,result:'passed',metrics});
 }
 await page.goto(origin+'/?lang=zh&view=reviews');
 await page.locator('[data-action=quick-role][data-role=mira]').click();
 await expect(page.locator('.rv-role-picker strong')).toHaveText('米拉');
 await expect(page.locator('.rv-interaction-card')).toHaveCount(2);
 results.push({name:'Quick persona chips filter the same shared scope',result:'passed'});
 await page.goto(origin+'/?view=reviews&id=r2&mode=edit&scenario=long');
 await expect(page.locator('.rv-exchange .rv-reference')).toHaveCount(2);
 await page.locator('.rv-exchange .rv-reference').first().locator('summary').click();
 await expect(page.locator('.rv-exchange .rv-prose').first()).toBeVisible();
 await page.locator('#field-text').fill('保留的输入');
 await page.locator('.rv-exchange .rv-reference').first().locator('summary').click();
 await expect(page.locator('#field-text')).toHaveValue('保留的输入');
 results.push({name:'Only long exchange text collapses; expanding and closing preserves input',result:'passed'});
 await page.goto(origin+'/?view=replies&id=s4&mode=edit');
 await page.locator('#field-text').fill('从页头保存');
 await page.locator('.rv-page-actions [data-action=save]').click();
 await expect(page.locator('.rv-page-actions [data-action=submit]')).toBeDisabled();
 await expect(page.locator('.rv-editor-footer [data-action=submit]')).toBeDisabled();
 await expect(page.locator('#rv-toast')).toContainText('草稿已暂存');
 await expect(page.locator('.rv-page-actions [data-action=submit]')).toBeEnabled();
 results.push({name:'Top and bottom save actions share operation and busy state',result:'passed'});
 console.log(JSON.stringify(results));
} finally {
 await writeFile(new URL('layout-verification.json',import.meta.url),JSON.stringify({environment:'Local browser, synthetic data only',results},null,2)+'\n');
 await browser.close();await new Promise(resolve=>server.close(resolve));
}
