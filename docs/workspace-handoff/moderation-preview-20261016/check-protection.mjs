import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base='https://plotstay.xingwu.dev';
const paths=['/_design/moderation/','/_design/moderation/index.html?lang=zh&view=moderation','/_design/moderation/index.html?lang=en&view=site','/_design/moderation/preview.js','/_design/moderation/preview.css','/_design/moderation/screenshots/moderation-zh-1440.png','/_design/moderation/missing-file','/_design/works/','/zh/workspace?view=moderation','/robots.txt'];
const report={time:new Date().toISOString(),results:[],authenticatedBrowser:'Not verified: no Basic Auth credential read or supplied. Same static files tested under /_design/moderation/ locally.'};
for(const path of paths){
 const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});
 const entry={path,status:r.status,robots:r.headers.get('x-robots-tag'),cache:r.headers.get('cache-control'),challenge:r.headers.get('www-authenticate')};
 assert.equal(r.status,path==='/robots.txt'?200:401,path);assert.match(entry.robots,/noindex.*nofollow.*noarchive/,path);assert.match(entry.cache,/no-store/,path);
 if(r.status===401)assert.match(entry.challenge,/Basic/,path);else assert.match(await r.text(),/Disallow: \//);
 report.results.push(entry);
}
const wrong=await fetch(base+'/_design/moderation/index.html',{headers:{Authorization:'Basic '+Buffer.from('invalid-design-check:invalid-design-check').toString('base64')},signal:AbortSignal.timeout(20000)});
assert.equal(wrong.status,401);report.results.push({path:'/_design/moderation/index.html',check:'Wrong credentials rejected',status:wrong.status});
await writeFile(new URL('./hosting-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.results.length,authenticatedBrowser:'not verified'}));
