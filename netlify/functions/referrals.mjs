import {getStore} from '@netlify/blobs';
import referrals from '../lib/referrals.js';
import service from '../lib/telegram-service.js';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export default async request=>{
 if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
 // Browser telemetry is untrusted. It must never trigger payments or operator conversions.
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'origin_rejected'},403);
 if(service.secretStatus()!=='valid')return reply({error:'not_configured'},503);
 let data;try{
  const reader=request.body?.getReader();if(!reader)return reply({error:'invalid_body'},400);
  const chunks=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2048){await reader.cancel();return reply({error:'body_too_large'},413)}chunks.push(Buffer.from(value))}
  data=JSON.parse(Buffer.concat(chunks).toString());
 }catch{return reply({error:'invalid_body'},400)}
 try{
  const store=()=>getStore({name:'betcheap-referrals',consistency:'strong'});
  if(data?.action==='report'){
   if(!service.authorized({headers:Object.fromEntries(request.headers)}))return reply({error:'unauthorized'},401);
   if(typeof data.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.date))return reply({error:'invalid_date'},400);
   if(!Number.isFinite(Date.parse(data.date))||new Date(data.date).toISOString().slice(0,10)!==data.date)return reply({error:'invalid_date'},400);
   return reply(await referrals.report(store(),data.date));
  }
  if(data?.action==='start'&&data.campaign===referrals.CAMPAIGN&&data.consent===true){
   const token=referrals.issue(process.env.TELEGRAM_WEBHOOK_SECRET);
   await referrals.record(store(),referrals.verify(token,process.env.TELEGRAM_WEBHOOK_SECRET),'visit');
   return reply({token});
  }
  const session=referrals.verify(data?.token,process.env.TELEGRAM_WEBHOOK_SECRET);
  if(data?.action!=='event'||!session||!referrals.TYPES.includes(data.type)||data.type==='visit')return reply({error:'invalid_event'},400);
  await referrals.record(store(),session,data.type);return reply({ok:true});
 }catch{return reply({error:'storage_unavailable'},503)}
};
