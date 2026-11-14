// Local preview for the exact static export served by Vercel. No application backend.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const root=resolve('out');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.f32':'application/octet-stream','.u8':'application/octet-stream','.i16':'application/octet-stream'};
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=resolve(root,'.'+pathname);
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    if((await stat(file)).isDirectory())file=resolve(file,'index.html');
    const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(content);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
}).listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log(`MarsPath static export: http://127.0.0.1:${Number(process.env.PORT)||3000}`));
