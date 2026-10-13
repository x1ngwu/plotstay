import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const base='https://plotstay.xingwu.dev';
const cases=[['/_design/personas/',401],['/_design/personas/?lang=en',401],['/_design/personas/app.js',401],['/_design/personas/style.css',401],['/_design/personas/screenshots/personas-list-zh-1440.png',401],['/_design/personas/missing-file',401],['/zh/workspace?view=personas',401],['/en/workspace?view=personas',401],['/zh/account',401],['/en/admin',401],['/api/me/personas',401],['/robots.txt',200],['/_design/personas/',401,'invalid-credentials']];
const results=[];
for(const[path,status,wrong]of cases){const r=await fetch(base+path,{headers:wrong?{Authorization:'Basic '+Buffer.from('invalid-preview-user:invalid-password').toString('base64')}:{},redirect:'manual',signal:AbortSignal.timeout(20000)});const entry={path,credentials:wrong||'none',status:r.status,robots:r.headers.get('x-robots-tag'),cache:r.headers.get('cache-control'),challenge:r.headers.get('www-authenticate')};assert.equal(r.status,status);assert.match(entry.robots,/noindex.*nofollow.*noarchive/);assert.match(entry.cache,/no-store/);if(status===401)assert.match(entry.challenge,/Basic/);else assert.match(await r.text(),/Disallow: \//);results.push(entry);}
await writeFile(root+'protection.json',JSON.stringify({time:new Date().toISOString(),results,authenticatedBrowser:'Not verified: no Basic Auth plaintext credential available'},null,2)+'\n');console.log(JSON.stringify({passed:results.length,authenticatedBrowser:'not verified'}));
