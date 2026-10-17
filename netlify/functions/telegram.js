'use strict';
const s=require('../lib/telegram-service');
exports.handler=async event=>{
 if(event.httpMethod==='GET')return s.response(200,{bot:s.BOT,channel:s.CHANNEL,configured:!!process.env.TELEGRAM_BOT_TOKEN,webhookSecretConfigured:/^[A-Za-z0-9_-]{32,256}$/.test(process.env.TELEGRAM_WEBHOOK_SECRET||''),version:'2.46.0',liveConnectionVerified:false});
 if(event.httpMethod!=='POST')return s.response(405,{error:'method_not_allowed'});
 if(!s.authorized(event))return s.response(401,{error:'unauthorized'});
 let update;try{update=s.parse(event)}catch{return s.response(400,{error:'invalid_update'})}
 if(!s.command(update))return s.response(200,{ok:true,ignored:true});
 try{
  // Acknowledge only after Netlify has queued the background invocation. Provider work must not delay Telegram's webhook.
  const r=await fetch(s.APP+'/.netlify/functions/telegram-process-background',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':process.env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify(update),signal:AbortSignal.timeout(8000),redirect:'error'});
  if(r.status!==202)return s.response(503,{error:'queue_unavailable'});
  return s.response(200,{ok:true});
 }catch{return s.response(503,{error:'queue_unavailable'})}
};
