import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
export function prototypeServer(){return createServer(async(req,res)=>{
 res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('Cache-Control','private, no-store');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!['.html','.css','.js','.png','.json'].includes(extname(path))){res.writeHead(404).end();return;}
 const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.json':'application/json'})[extname(path)]);res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404).end('Not found');}
});}
if(process.argv[1]===fileURLToPath(import.meta.url)){const server=prototypeServer();server.listen(Number(process.env.OVERVIEW_PORT??4398),'127.0.0.1',()=>console.log(`Overview preview: http://127.0.0.1:${server.address().port}`));}
