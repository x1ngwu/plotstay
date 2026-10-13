// Reads the existing deployed renderer; replaces every browser API response with sample data.
// Never authenticates, writes to an API, or reads credentials.
import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const p=(id,zh,en,bio,head,submitted,published,avatar='mint')=>({id,disabled:false,head_revision_id:head,submitted_revision_id:submitted,published_revision_id:published,draft:{'zh-CN':{name:zh,bio,avatar},en:{name:en,bio,avatar}},published:{},submitted:submitted?{'zh-CN':{name:zh},en:{name:en}}:null});
const browser=await chromium.launch({headless:true});const report={scope:'Existing deployed renderer; browser-only synthetic API responses; no account login or business writes',pages:[],screens:[],errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(8000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;if(route.request().method()!=='GET')throw new Error('Unexpected write request');const result=path==='/api/auth/me'?{actor:{id:'sample-account',email:'sample-account',siteRole:'user'}}:path==='/api/admin/worlds'?{worlds:[]}:path==='/api/me/personas'?{personas:[p('reed','苇舟','Reed','随身带着一本空白地图。\n收集问候，也收集归途。','v3','v2','v1'),p('orbit','环星','Orbit','灯火亮起时，故事才刚刚开始。','v1','v1',null,'sky'),p('moss','青苔','Moss','慢慢走，让雨落在身后。','v1',null,null,'amber')]}:{};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});});
 await page.goto('http://127.0.0.1:4321/zh/workspace?view=personas');await expect(page.locator('#account-view h3')).toHaveCount(3);await page.screenshot({path:root+'screenshots/personas-before-zh-1440.png',fullPage:true});report.screens.push('personas-before-zh-1440.png');
 for(const path of ['/zh/workspace?view=personas','/en/workspace?view=personas','/zh/account?view=personas','/en/account?view=personas','/zh/admin','/en/admin','/api/health']){const response=await page.request.get('http://127.0.0.1:4321'+path);report.pages.push({path,status:response.status()});if(response.status()!==200)throw new Error(path+' '+response.status());}
 await writeFile(root+'baseline-readonly.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
