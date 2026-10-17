'use strict';
// Use the modern Netlify runtime for automatic Blobs credentials and strong-consistency reads.
module.exports=async function adapter(request,handler){
 const result=await handler({httpMethod:request.method,headers:Object.fromEntries(request.headers),body:request.method==='POST'?await request.text():''});
 return new Response(result.body,{status:result.statusCode,headers:result.headers});
};
