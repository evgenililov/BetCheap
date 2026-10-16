'use strict';
// Local Netlify legacy-function adapter. No production deployment or fake feed.
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname.startsWith('/.netlify/functions/')){
   const name=u.pathname.slice('/.netlify/functions/'.length);
   if(!/^[a-z-]+$/.test(name))throw Error('not_found');
   // Trusted Netlify geography is unavailable here: never emulate it from headers.
   if(name==='affiliate-route'){
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    return res.end(JSON.stringify({kind:'none',verified:false}));
   }
   const file=path.join(root,'netlify/functions',name+'.js');
   await fs.access(file);
   const result=await require(file).handler({httpMethod:req.method,queryStringParameters:Object.fromEntries(u.searchParams),headers:req.headers});
   res.writeHead(result.statusCode,result.headers);return res.end(result.body);
  }
  let pathname=decodeURIComponent(u.pathname);
  if(['/', '/compare','/compare.html'].includes(pathname))pathname='/index.html';
  if(!/^\/(?:assets\/[a-zA-Z0-9._-]+|[a-zA-Z0-9_-]+\.html)$/.test(pathname))throw Error('not_found');
  const file=path.join(root,pathname);
  const data=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch(e){res.writeHead(e.code==='ENOENT'||e.message==='not_found'?404:500,{'Content-Type':'text/plain'});res.end('Request unavailable');}
});
server.listen(Number(process.env.PORT)||8888,'127.0.0.1',()=>console.log('BetCheap local development server started'));
