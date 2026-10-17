'use strict';
const s=require('../lib/telegram-service');
// Scheduled Functions cannot be called via a production URL. Provider calls run in a background function.
exports.handler=async()=>{
 if(!process.env.TELEGRAM_WEBHOOK_SECRET)return s.response(200,{state:'not_configured'});
 try{
  const r=await fetch(s.APP+'/.netlify/functions/telegram-publish-background',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':process.env.TELEGRAM_WEBHOOK_SECRET},body:'{}',signal:AbortSignal.timeout(8000),redirect:'error'});
  return s.response(r.status===202?200:503,{state:r.status===202?'queued':'queue_failed'});
 }catch{return s.response(503,{state:'queue_failed'})}
};
