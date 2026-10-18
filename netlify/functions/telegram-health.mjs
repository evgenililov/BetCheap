import service from '../lib/telegram-service.js';
import admin from '../lib/telegram-admin-handler.js';
let cached,expires=0,pending;
// Public, read-only operational check. No user messages, secret values or webhook URL are returned.
export default async request=>{
 if(request.method!=='GET')return Response.json({error:'method_not_allowed'},{status:405});
 if(!cached||Date.now()>=expires){
  if(!pending)pending=(async()=>{
   if(service.secretStatus()!=='valid')return {ok:false,stage:'configuration',reason:'webhook_secret_invalid'};
   const r=await admin.handler({httpMethod:'POST',headers:{'x-telegram-bot-api-secret-token':process.env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify({action:'status'})});
   const d=JSON.parse(r.body),out={};
   for(const k of ['ok','error','stage','reason','errorType','runtimeCode','nodeVersion','upstreamStatus','bot','canPost','webhookCorrect','publishingEnabled','today'])if(d[k]!==undefined)out[k]=d[k];
   return out;
  })();
  try{cached=await pending;expires=Date.now()+60000}finally{pending=null}
 }
 return Response.json(cached,{headers:{'Cache-Control':'no-store'}});
};
