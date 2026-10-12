// Reproducible artifact checks and read-only preview spike. Never calls a write API.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {prototypeServer} from './serve.mjs';
const here=fileURLToPath(new URL('.',import.meta.url));
const report={date:new Date().toISOString(),scope:'Standalone prototype and read-only technical spike; not production acceptance',checks:[],screens:[],realPages:[]};
const check=(name,details={})=>{report.checks.push({name,...details});console.log('PASS',name);};
const hash=x=>createHash('sha256').update(x).digest('hex');
const sourceFiles=['apps/web/src/components/DetailBody.astro','apps/web/src/lib/structured-fields.ts','apps/web/src/pages/api/admin/preview/[locale]/[id].astro','apps/web/package.json','package-lock.json'];
const before=Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,hash(await readFile(p))])));
await mkdir(here+'screenshots',{recursive:true});
const server=prototypeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().method()==='GET'?r.continue():r.abort());
 await page.goto(origin);await expect(page.locator('h1')).toHaveText('今天，从这里继续');
 const routes=['overview','works','personas','persona','editor','interactions','admissions','worlds','world','review','returned','world-new','new-work','admission-review','world-content','world-settings','world-members'];
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  for(const route of routes){
   await page.goto(origin+'/#'+route);await expect(page.locator('h1')).toHaveCount(1);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} overflows at ${width}`);
   if((width===1440&&['overview','works','editor','review','world-settings'].includes(route))||(width===390&&['overview','editor','world-settings'].includes(route))){
    if(route==='editor')await expect(page.frameLocator('#preview').locator('h1')).toBeAttached();
    const name=`${route}-${width}.png`;await page.screenshot({path:here+'screenshots/'+name,fullPage:true});report.screens.push(name);
   }
  }
 }
 check('17 screens at desktop and mobile: no document overflow');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  for(const subroute of ['world-settings','world-members','world-content','admission-review','review']){
   await page.goto(origin+'/?navigation='+width+subroute+'#'+subroute);
   const crumbs=page.getByRole('navigation',{name:'面包屑'});
   await expect(crumbs.getByRole('link',{name:'我管理的世界',exact:true})).toHaveAttribute('href','#worlds');
   await expect(crumbs.getByRole('link',{name:'拉斯世界管理',exact:true})).toHaveAttribute('href','#world');
   await page.locator('#page-back').click();await expect(page.locator('h1')).toHaveText('拉斯世界管理');
   await page.locator('#page-back').click();await expect(page.locator('h1')).toHaveText('我管理的世界');
  }
 }
 check('world subpages have clickable breadcrumbs and two-level returns on desktop/mobile');
 await page.goto(origin+'/?navigation=editor#world-content');
 await page.getByRole('link',{name:'编辑作品',exact:true}).first().click();
 await expect(page.locator('#page-back')).toHaveAttribute('href','#world-content');
 await expect(page.getByRole('navigation',{name:'面包屑'}).getByRole('link',{name:'世界内容',exact:true})).toBeVisible();
 await page.locator('#edit-title').fill('返回时应保留的输入');
 page.once('dialog',d=>d.dismiss());await page.locator('#page-back').click();
 await expect(page.locator('#edit-title')).toHaveValue('返回时应保留的输入');
 await expect(page).toHaveURL(/#editor$/);
 page.once('dialog',d=>d.accept());await page.locator('#page-back').click();
 await expect(page.locator('h1')).toHaveText('世界内容');
 check('world editor returns to its source and cancelling leave preserves input');
 await page.goto(origin+'/?navigation=direct#world-settings');
 await page.getByRole('navigation',{name:'面包屑'}).getByRole('link',{name:'我管理的世界',exact:true}).click();
 await expect(page.locator('h1')).toHaveText('我管理的世界');
 check('direct deep link has working ancestor navigation without browser history');

 await page.goto(origin+'/?case=mobile#editor');
 await page.getByRole('button',{name:'预览',exact:true}).click();
 await expect(page.frameLocator('#preview').locator('h1')).toBeVisible();
 await page.frameLocator('#preview').locator('[data-section=description]').click();
 await expect(page.locator('#edit-description')).toBeFocused();
 await expect(page.locator('#edit-description')).toBeVisible();
 check('mobile preview selection returns to visible editor');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  await page.goto(origin+'/?case=site'+width+'#site');
  await expect(page.locator('h1')).toHaveText('需要网站管理权限');
  await page.locator('#role').selectOption('site');
  await expect(page.locator('h1')).toHaveText('网站审核');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto(origin+'/#settings');await expect(page.locator('h1')).toHaveText('账号设置');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 check('site and account settings access states and widths');
 await page.goto(origin+'/?case=phase#overview');await page.locator('#phase').selectOption('1');
 await expect(page.getByText('拉斯世界的入驻申请已通过',{exact:true})).toHaveCount(0);
 await page.goto(origin+'/?case=phase#worlds');await expect(page.getByRole('link',{name:'＋ 创建世界',exact:true})).toHaveCount(0);
 await page.locator('#role').selectOption('creator');await page.goto(origin+'/?case=phase#editor');
 await expect(page.locator('#preview')).toHaveCount(0);
 check('phase one excludes new admission and creator capabilities');
 await page.goto(origin+'/?case=work-tests#works');

 await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/#works');
 await page.locator('#search').fill('夜行');await page.getByRole('button',{name:'筛选',exact:true}).click();await expect(page.locator('.work-card')).toHaveCount(1);
 await page.getByRole('link',{name:'查看意见并修改'}).click();await page.getByRole('link',{name:'返回作品列表'}).click();await expect(page.locator('#search')).toHaveValue('夜行');check('work search survives detail/back navigation');
 await page.goto(origin+'/#editor');const frame=()=>page.frameLocator('#preview');
 await expect(frame().locator('h1')).toHaveText('月影旅馆 · 临港房间');
 await page.locator('#edit-title').fill('已保存的测试标题');await expect(frame().locator('h1')).toHaveText('月影旅馆 · 临港房间');await expect(page.locator('#save-state')).toContainText('未保存');
 await page.getByRole('button',{name:'保存并预览',exact:true}).click();await expect(frame().locator('h1')).toHaveText('已保存的测试标题');await expect(page.locator('#save-state')).toContainText('公开版本 v2');check('save/preview keeps unsaved edits and public revision separate');
 await frame().locator('[data-section=description]').click();await expect(page.locator('#edit-description')).toBeFocused();check('preview selection focuses matching editor');
 await page.locator('[data-section=basics]').click();await expect(frame().locator('[data-section=basics]')).toHaveClass('selected');
 await frame().locator('[data-section=description]').focus();await frame().locator('[data-section=description]').press('Enter');await expect(page.locator('#edit-description')).toBeFocused();check('editor-to-preview focus and preview keyboard selection');
 await page.locator('[data-section=basics]').click();await page.locator('#edit-title').fill('仍在本地的修改');
 await page.locator('details summary').click();
 for(const kind of ['network','session','conflict']){await page.locator('#failure').selectOption(kind);await page.getByRole('button',{name:'保存并预览',exact:true}).click();await expect(page.locator('#edit-title')).toHaveValue('仍在本地的修改');await expect(frame().locator('h1')).toHaveText('已保存的测试标题');}
 check('network/session/conflict simulations preserve input and previous preview');
 await page.getByRole('button',{name:'English',exact:true}).click();await page.locator('#edit-title').fill('Uncommitted English');await page.getByRole('button',{name:'中文',exact:true}).click();await expect(page.locator('#edit-title')).toHaveValue('仍在本地的修改');check('language switching preserves local edits');
 await page.goto(origin+'/?case=roles#editor');await page.locator('#role').selectOption('creator');await expect(page.getByRole('button',{name:'提交审核',exact:true})).toBeVisible();
 await page.locator('#role').selectOption('visitor');await expect(page.locator('#preview')).toHaveCount(0);
 await page.locator('#phase').selectOption('1');await expect(page.locator('#nav a[href="#admissions"]')).toHaveCount(0);check('prototype capability and phase states');
 // Message boundary checks use real browser MessageEvents but controlled metadata.
 await page.goto(origin+'/?case=bridge#editor');await expect(frame().locator('h1')).toBeVisible();
 const rejected=await page.evaluate(()=>{
  const f=document.querySelector('#preview');let count=0;const probe=createPreviewBridge({frame:f,origin:location.origin,session:'probe',revision:'r1',onSelect:()=>count++});
  const good={channel:'plotstay-preview-v1',type:'select',session:'probe',revision:'r1',section:'basics'};
  for(const overrides of [{origin:'https://invalid.example'},{source:window},{data:{...good,session:'old'}},{data:{...good,revision:'r0'}},{data:{...good,section:'unknown'}},{data:{...good,type:'publish'}}])window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:f.contentWindow,data:good,...overrides}));
  const before=count;window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:f.contentWindow,data:good}));probe.destroy();return {before,after:count};
 });assert.deepEqual(rejected,{before:0,after:1});check('bridge rejects wrong origin/source/session/revision/section/action');
 // Compile and exercise the actual existing schema form, without changing runtime code.
 const compiled=await build({stdin:{contents:"import {structuredFields} from './apps/web/src/lib/structured-fields.ts'; import {textSchema} from './packages/contracts/src/base.ts'; window.spike={structuredFields,textSchema};",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'});
 await page.addScriptTag({content:compiled.outputFiles[0].text});
 const initial=await page.evaluate(()=>{
  const data=spike.textSchema.parse({title:'Before',description:'Body',summary:'Keep this',tags:['one'],hostName:'Host',imageAlts:{cover:'A room'},clearedFields:['hostBio']});
  window.probeInitial=structuredClone(data);window.probeValue=data;
  document.querySelector('#main').innerHTML='<div id="schema-form"></div>';
  spike.structuredFields(document.querySelector('#schema-form'),spike.textSchema,data,v=>window.probeValue=v,{zh:true,path:'zh-CN',keys:['title']});return data;
 });await page.locator('[name="zh-CN.title"]').fill('After');
 const roundTrip=await page.evaluate(()=>({valid:spike.textSchema.safeParse(probeValue).success,data:probeValue}));assert(roundTrip.valid);assert.deepEqual(roundTrip.data,{...initial,title:'After'});check('actual structuredFields + textSchema: editing title preserves hidden fields');
 if(process.env.HANDOFF_LIVE_SPIKE==='1'){
  const base='http://127.0.0.1:4321';
  const types=[['stays','dockside-window',['.detail-heading h1','#about','#facilities','#host','#rules']],['experiences','forge-walk',['.experience-introduction h1','#about','#itinerary','#host','#rules']],['services','augmetic-tune-up',['.service-introduction h1','#service-items','#service-gallery','#host','#rules']]];
  for(const locale of ['zh','en'])for(const [type,slug,selectors]of types){
   const path=`/${locale}/worlds/lathe-worlds/${type}/${slug}`;const res=await fetch(base+path);assert.equal(res.status,200,path);const html=await res.text();
   const snapshot=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<head>',`<head><base href="${base}/">`);
   await page.goto(origin+'/?case='+locale+type+'#editor');
   await page.locator('#preview').evaluate((f,html)=>f.srcdoc=html,snapshot);
   for(const selector of selectors)await expect(frame().locator(selector)).toHaveCount(1);
   report.realPages.push({path,sha256:hash(html),selectors});
   if(locale==='zh'&&type==='stays'){
    const beforeText=await frame().locator('main').innerText();
    const f=page.frames().find(f=>f.parentFrame());
    await f.evaluate(({origin,selector})=>{
     const heading=document.querySelector(selector);heading.tabIndex=0;
     heading.addEventListener('click',()=>parent.postMessage({channel:'plotstay-preview-v1',type:'select',session:'demo-session',revision:'3',section:'basics'},origin));
     window.addEventListener('message',e=>{if(e.origin!==origin||e.source!==parent||e.data?.type!=='focus'||e.data?.session!=='demo-session'||e.data?.revision!=='3')return;document.querySelector(e.data.section==='description'?'#about':selector)?.scrollIntoView({block:'center'});});
    },{origin,selector:selectors[0]});
    assert.equal(await frame().locator('main').innerText(),beforeText);
    await page.locator('[data-section=description]').click();await frame().locator(selectors[0]).click();await expect(page.locator('#edit-title')).toBeFocused();
    check('existing published HTML snapshot supports private preview-to-form selection without content rewrite');
   }
  }
  check('existing zh/en stay/experience/service DOM section targets',{pages:report.realPages.length});
 }
 assert.deepEqual(errors,[]);check('no prototype browser script errors');
 for(const p of sourceFiles)assert.equal(hash(await readFile(p)),before[p],p);
 check('source components, schema form and dependency manifests unchanged');
 report.liveSpike=process.env.HANDOFF_LIVE_SPIKE==='1';
 await writeFile(here+'verification.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({checks:report.checks.length,screens:report.screens.length,livePages:report.realPages.length}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
