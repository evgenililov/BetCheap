'use strict';
const {createHmac,randomUUID,timingSafeEqual}=require('node:crypto');
const CAMPAIGN='championz';
const TYPES=['visit','comparison','onexbet_click','cloudbet_click','betsson_click'];
const day=now=>new Date(now).toISOString().slice(0,10);
function sign(payload,secret){return createHmac('sha256',secret).update('betcheap-referral-v1:'+payload).digest('hex')}
function issue(secret,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({campaign:CAMPAIGN,id:randomUUID(),day:day(now),expires:now+86400000})).toString('base64url');
 return payload+'.'+sign(payload,secret);
}
function verify(token,secret,now=Date.now()){
 if(typeof token!=='string'||token.length>600)return null;
 const [payload,signature,...extra]=token.split('.');
 if(extra.length||!signature||!/^[a-f0-9]{64}$/.test(signature)||!timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload,secret))))return null;
 try{const value=JSON.parse(Buffer.from(payload,'base64url'));return value.campaign===CAMPAIGN&&/^[a-f0-9-]{36}$/.test(value.id)&&/^\d{4}-\d{2}-\d{2}$/.test(value.day)&&Number.isFinite(value.expires)&&value.expires>now&&value.expires<=now+86400000?value:null}catch{return null}
}
async function record(store,session,type){
 if(!TYPES.includes(type))throw Error('invalid_type');
 // One record per action category per consented session. Never a financial conversion.
 const key=session.day+'/'+session.campaign+'/'+session.id+'/'+type;
 return store.setJSON(key,{type},{onlyIfNew:true});
}
async function report(store,date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||day(Date.parse(date))!==date)throw Error('invalid_date');
 const counts=Object.fromEntries(TYPES.map(type=>[type,0]));let scanned=0,truncated=false;
 for await(const page of store.list({prefix:date+'/'+CAMPAIGN+'/',paginate:true})){
  for(const blob of page.blobs){if(scanned>=10000){truncated=true;break}scanned++;const type=blob.key.split('/').at(-1);if(TYPES.includes(type))counts[type]++}
  if(truncated)break;
 }
 return {campaign:CAMPAIGN,date,counts,truncated,qualification:'consented_browser_sessions_not_unique_people',operatorAttribution:'not_verified',qualifiedCustomers:null,commissionDue:null};
}
module.exports={CAMPAIGN,TYPES,issue,verify,record,report};
