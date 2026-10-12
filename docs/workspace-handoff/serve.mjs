// Standalone design artifacts only. No application/API/database connection.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, extname, sep} from 'node:path';
const root=fileURLToPath(new URL('./prototype/',import.meta.url));
export function prototypeServer() {
 return createServer(async(req,res)=>{
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  try {
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
   if(!path.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403).end();return;}
   const data=await readFile(path);
   res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json'})[extname(path)]??'application/octet-stream');
   res.end(data);
  }catch{res.writeHead(404).end('Not found');}
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 const server=prototypeServer();
 server.listen(Number(process.env.HANDOFF_PORT??4399),'127.0.0.1',()=>console.log(`Design prototype: http://127.0.0.1:${server.address().port}`));
}
