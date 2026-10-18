import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {prototypeServer} from './serve.mjs';
const prefix='/_design/moderation';
const server=prototypeServer({basePath:prefix});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}${prefix}/`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const report={scope:'Local browser, exact hosted prefix and static files; synthetic data only',checks:[],errors:[]};
context.on('request',r=>{if(!r.url().startsWith(base)||r.method()!=='GET')report.errors.push(`Unexpected request: ${r.method()} ${r.url()}`);});
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
await mkdir(new URL('./screenshots/',import.meta.url),{recursive:true});
const action=(name)=>page.locator(`[data-action="${name}"]`);
const load=async(query='')=>{await page.goto(base+'index.html?'+query);await expect(page.locator('h1')).toBeVisible();};
const screenshot=async(name)=>{await page.screenshot({path:new URL(`./screenshots/${name}.png`,import.meta.url).pathname,fullPage:true});};
const check=async(name,fn)=>{await fn();report.checks.push({name,result:'passed'});};
try{
 await check('Review queue: separate columns, pending counts, no list approval buttons',async()=>{
  await load('lang=zh&view=moderation');await expect(page.locator('h1')).toHaveText('评价与回复审核');await expect(page.locator('.queue-row')).toHaveCount(5);await expect(action('publish-record')).toHaveCount(0);await screenshot('01-moderation-zh-desktop');
 });
 await check('Independent review/reply pagination and full-list search',async()=>{
  await action('page').last().click();await expect(page.locator('.pagenum')).toHaveText('2');await action('mod-tab').filter({hasText:'提供者'}).click();await expect(page.locator('.pagenum')).toHaveText('1');await action('mod-tab').first().click();await expect(page.locator('.pagenum')).toHaveText('2');
  await page.locator('[name=q]').fill('伊芙琳');await page.locator('#queue-search [type=submit]').click();await expect(page.locator('.pagenum')).toHaveText('1');expect(await page.locator('.queue-row').count()).toBeGreaterThan(0);
 });
 await check('Detail returns to filters and position; dirty review note confirmation',async()=>{
  await load('lang=zh&view=moderation&status=all&page=2');await page.evaluate(()=>window.scrollTo(0,240));const y=await page.evaluate(()=>scrollY);
  await action('open-record').first().click();await expect(action('back-moderation')).toBeVisible();await action('back-moderation').click();await expect(page.locator('.pagenum')).toHaveText('2');await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(y);
  await load('lang=zh&view=moderation&detail=r1');await page.locator('[data-note=r1]').fill('核对送审版本');await action('back-moderation').click();await expect(page.getByRole('dialog')).toContainText('审核说明尚未提交');await action('cancel-modal').click();await expect(page.locator('[data-note=r1]')).toHaveValue('核对送审版本');await page.locator('[data-note=r1]').fill('');
 });
 await check('Fixed submission, publication and later draft stay separate',async()=>{
  await load('lang=zh&view=moderation&detail=r1');await expect(page.locator('.versions [data-action=version]')).toHaveCount(3);await screenshot('02-review-detail-zh-desktop');
  await action('version').filter({hasText:'后续草稿'}).click();await expect(action('publish-record')).toHaveCount(0);await expect(page.locator('.read-state')).toContainText('仅供参考');
  await action('version').first().click();await action('publish-record').click();await expect(page.getByRole('dialog')).toContainText('网站级决定');await screenshot('03-combined-confirmation');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 });
 await check('Combined approval changes only this mock post; later draft retained',async()=>{
  const before=await page.evaluate(()=>structuredClone(PlotstayPreview.getData()));await action('publish-record').click();await action('confirm-modal').click();
  const after=await page.evaluate(()=>PlotstayPreview.getData());expect(after.reviews.find(x=>x.id==='r1').pubVersion).toBe(4);expect(after.reviews.find(x=>x.id==='r1').draft).toBeTruthy();expect(after.reviews.filter(x=>x.id!=='r1')).toEqual(before.reviews.filter(x=>x.id!=='r1'));expect(after.replies).toEqual(before.replies);
 });
 await check('Reply has independent full detail and original review context',async()=>{
  await load('lang=zh&view=moderation&tab=replies&detail=a1');await expect(page.locator('.original-review')).toBeVisible();await screenshot('04-reply-detail-zh-desktop');
 });
 await check('Profile comparison, separate availability and profile-only approval',async()=>{
  await load('lang=zh&view=site');await expect(page.locator('h1')).toHaveText('网站管理');await screenshot('05-site-zh-desktop');
  await load('lang=zh&view=site&detail=p1');await expect(page.locator('.profile-version')).toHaveCount(2);await expect(action('disable-profile')).toBeVisible();await screenshot('06-profile-detail-zh-desktop');
  const before=await page.evaluate(()=>structuredClone(PlotstayPreview.getData().reviews));await action('approve-profile').click();expect(await page.evaluate(()=>PlotstayPreview.getData().reviews)).toEqual(before);
 });
 await check('Site tools are separate tabs; account form validation and simulated saving',async()=>{
  await load('lang=zh&view=site&tab=accounts');await expect(page.locator('.queue-panel')).toHaveCount(0);await expect(page.locator('.binding-card')).toHaveCount(0);await screenshot('07-account-zh-desktop');
  await page.locator('#create-account [type=submit]').click();await expect(page.locator('#account-error')).toContainText('邮箱');await page.locator('[name=email]').fill('preview@example.test');await page.locator('[name=password]').fill('short');await page.locator('#create-account [type=submit]').click();await expect(page.locator('#account-error')).toContainText('12');
  await page.locator('[name=password]').fill('Example-only-123');await page.locator('#create-account [type=submit]').click();await expect(page.locator('#create-account [type=submit]')).toBeDisabled();await expect(page.locator('.readback-result')).toContainText('没有创建真实账号');await expect(page.locator('[name=password]')).toHaveValue('');expect(await page.evaluate(()=>Object.keys(localStorage).length+Object.keys(sessionStorage).length)).toBe(0);expect(page.url()).not.toContain('Example');
 });
 await check('Account failure and unknown result are not displayed as success',async()=>{
  for(const scenario of ['save-error','unknown']){
   await load('lang=zh&view=site&tab=accounts&scenario='+scenario);await page.locator('[name=email]').fill('preview@example.test');await page.locator('[name=password]').fill('Example-only-123');await page.locator('#create-account [type=submit]').click();
   if(scenario==='save-error')await expect(page.locator('#account-error')).toContainText('创建失败');else {await expect(action('check-account')).toBeVisible();await expect(page.locator('#create-account [type=submit]')).toBeDisabled();await screenshot('08-account-unknown');await action('check-account').click();await expect(page.locator('.readback-result')).toContainText('没有创建真实账号');}
  }
 });
 await check('Binding locked and nonowner read-only states have no save',async()=>{
  await load('lang=zh&view=site&tab=bindings&entry=b1');await expect(action('save-binding')).toHaveCount(0);await screenshot('09-binding-locked');await page.locator('[data-select=binding-entry]').selectOption('b3');await expect(page.locator('.binding-card')).toContainText('你不是该条目的所有者');await expect(action('save-binding')).toHaveCount(0);
 });
 await check('Dynamic assignment confirmation in both directions, current entry and persona',async()=>{
  await load('lang=zh&view=site&tab=bindings&entry=b2');await page.locator('[data-select=binding-persona]').selectOption('p9');await screenshot('10-binding-editable');await action('save-binding').click();await expect(page.getByRole('dialog')).toContainText('塞缪尔 → 索恩');await action('confirm-modal').click();await expect(page.locator('.readback-result')).toContainText('绑定已保存');await page.locator('[data-select=binding-persona]').selectOption('p2');await action('save-binding').click();await expect(page.getByRole('dialog')).toContainText('索恩 → 塞缪尔');await action('cancel-modal').click();
 });
 await check('Binding failure, unknown result, and late completion after entry change',async()=>{
  for(const scenario of ['save-error','unknown']){
   await load('lang=zh&view=site&tab=bindings&entry=b2&scenario='+scenario);await page.locator('[data-select=binding-persona]').selectOption('p9');await action('save-binding').click();await action('confirm-modal').click();await expect(action('save-binding')).toBeDisabled();
   if(scenario==='save-error')await expect(page.locator('.error-text')).toContainText('原绑定保持不变');else {await expect(action('check-binding')).toBeVisible();await action('check-binding').click();await expect(page.locator('.binding-summary')).toContainText('索恩');}
  }
  await load('lang=zh&view=site&tab=bindings&entry=b2');await page.locator('[data-select=binding-persona]').selectOption('p9');await action('save-binding').click();await action('confirm-modal').click();await page.locator('[data-select=binding-entry]').selectOption('b3');await page.waitForTimeout(800);await expect(page.locator('.readback-result')).toHaveCount(0);await expect(page.locator('.binding-summary')).toContainText('锈红修理室');
 });
 await check('No candidate and loading failure binding states',async()=>{
  await load('lang=zh&view=site&tab=bindings&entry=b2&scenario=no-candidates');await expect(page.locator('.binding-card')).toContainText('没有可选角色');await expect(action('save-binding')).toHaveCount(0);await screenshot('11-binding-no-candidates');
  await load('lang=zh&view=site&tab=bindings&scenario=error');await expect(page.locator('main')).toContainText('无法加载绑定信息');await action('retry').click();await expect(page.locator('.binding-card')).toBeVisible();
 });
 await check('Empty and failure queues, stale submission blocks decisions',async()=>{
  await load('lang=zh&scenario=empty');await expect(page.locator('.queue-row')).toHaveCount(0);await expect(page.locator('.empty-state')).toContainText('没有需要处理');
  await load('lang=zh&scenario=error');await expect(page.locator('.empty-state')).toContainText('这不是空列表');
  await load('lang=zh&detail=r1&scenario=conflict');await expect(action('publish-record')).toBeDisabled();await screenshot('12-stale-submission');
 });
 await check('World administrator cannot enter site management',async()=>{
  await load('lang=zh&actor=world&view=site');await expect(page.locator('h1')).toHaveText('没有网站管理权限');await expect(page.locator('[data-nav^="site:"]')).toHaveCount(0);await expect(page.locator('#create-account')).toHaveCount(0);
 });
 await check('Interface language is independent of content language',async()=>{
  await load('lang=zh&detail=r1');await action('content-en').click();await action('ui-en').click();await action('ui-zh').click();await expect(action('content-en')).toHaveClass('active');
 });
 for(const lang of ['zh','en'])for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  for(const [name,query] of [['moderation','view=moderation'],['review','view=moderation&detail=r1'],['reply','view=moderation&tab=replies&detail=a1'],['site','view=site'],['profile','view=site&detail=p1'],['account','view=site&tab=accounts'],['binding','view=site&tab=bindings&entry=b2']]){
   await check(`${name} ${lang} ${width}: no horizontal page overflow`,async()=>{await load(`lang=${lang}&${query}`);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect.poll(()=>page.evaluate(()=>{const active=document.querySelector('.tabs button.active');if(!active)return true;const a=active.getBoundingClientRect(),b=active.parentElement.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;})).toBe(true);await screenshot(`${name}-${lang}-${width}`);});
  }
 }
 await check('CSP blocks business connections; all observed requests are local static GETs',async()=>{
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content',/connect-src 'none'/);expect(report.errors).toEqual([]);
 });
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await new Promise(r=>server.close(r));report.finishedAt=new Date().toISOString();await writeFile(new URL('./verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
