// Local preview for the exact static export served by Vercel. No application backend.
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const root=resolve(process.env.MARSPATH_STATIC_ROOT || 'out');
const mime={'.html':'text/html; charset=utf-8','.txt':'text/x-component; charset=utf-8','.ico':'image/vnd.microsoft.icon','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.svg':'image/svg+xml','.woff2':'font/woff2','.f32':'application/octet-stream','.u8':'application/octet-stream','.i16':'application/octet-stream'};
function send(req, res, file, size) {
  const headers = { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (req.headers.range) {
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range) {
      start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      if (range[1] && range[2]) end = Math.min(end, Number(range[2]));
    }
    if (!range || start > end) {
      res.writeHead(416, { ...headers, 'Content-Range': 'bytes */' + size }).end();
      return;
    }
    status = 206;
    headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size;
  }
  res.writeHead(status, { ...headers, 'Content-Length': end - start + 1 });
  if (req.method === 'HEAD' || !size) res.end();
  else {
    const stream = createReadStream(file, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }
}
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=resolve(root,'.'+pathname);
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    let info = await stat(file);
    if (info.isDirectory()) {
      file = resolve(file, 'index.html');
      info = await stat(file);
    }
    if (!info.isFile()) throw new Error('Not a static file');
    send(req, res, file, info.size);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
}).listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log(`MarsPath static export: http://127.0.0.1:${Number(process.env.PORT)||3000}`));
