import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,symlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'esbuild';

assert.equal(process.env.DOTENV_CONFIG_PATH,'/dev/null','Set DOTENV_CONFIG_PATH=/dev/null explicitly.');
const repo=fileURLToPath(new URL('../../../../',import.meta.url));
const dir=resolve(process.env.PLOTSTAY_TEST_BUILD??'/tmp/plotstay-works-fixes-0cb348b');
assert.ok(dir.startsWith('/tmp/plotstay-works-fixes-'),'Use a dedicated /tmp/plotstay-works-fixes-* build directory.');
await mkdir(dir,{recursive:true});
await symlink(repo+'/node_modules',dir+'/node_modules').catch(e=>{if(e.code!=='EEXIST')throw e;});
execFileSync('npm',['run','build','--workspace','@plotstay/web'],{
  cwd:repo,stdio:'inherit',env:{...process.env,PLOTSTAY_TEST_OUT_DIR:dir+'/web'},
});
for(const [entry,output]of [['apps/api/src/server.ts','api/server.mjs'],['apps/worker/src/main.ts','worker/main.mjs']])
  await build({entryPoints:[repo+entry],outfile:dir+'/'+output,bundle:true,platform:'node',target:'node22',format:'esm',external:['pg','dotenv','fastify','@fastify/*','zod']});
const wrapper=await readFile(repo+'apps/web/server.mjs','utf8');
assert.ok(wrapper.includes("'./dist/server/entry.mjs'"));
await writeFile(dir+'/web-server.mjs',wrapper.replace("'./dist/server/entry.mjs'","'./web/server/entry.mjs'"));
console.log('Isolated build ready:',dir);
