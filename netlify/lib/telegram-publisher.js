'use strict';
const s=require('./telegram-service');
const odds=require('./telegram-odds');
async function publish(store,deps={matches:odds.matches,comparison:odds.comparison,send:s.send},now=new Date()){
 const settings=await store.get('settings',{type:'json'});
 if(settings?.publishingEnabled!==true)return {state:'disabled'};
 const key='publication/'+now.toISOString().slice(0,10);
 if(!await s.claim(store,key))return {state:'already_attempted'};
 let outcome={state:'no_verified_comparison'};
 try{
  const events=await deps.matches();
  for(const e of events.slice(0,3)){
   let payload;try{payload=await deps.comparison(e)}catch{continue}
   if(!payload)continue;
   // Record an uncertain state before the external send. Never resend automatically after ambiguity.
   await store.setJSON(key,{state:'delivery_unknown',eventId:String(e.sportEventId),at:now.toISOString()});
   try{const r=await deps.send(s.CHANNEL,payload);outcome={state:'sent',eventId:String(e.sportEventId),messageId:r.message_id}}
   catch{outcome={state:'delivery_unknown'}}
   await store.setJSON(key,{...outcome,at:now.toISOString()});return outcome;
  }
 }catch{outcome={state:'feed_unavailable'}}
 await store.setJSON(key,{...outcome,at:now.toISOString()});return outcome;
}
async function cleanup(store,now=new Date()){
 // Update IDs expire only after incoming updates would already be rejected for age; preserve 7 days of deduplication.
 const cutoff=new Date(now.getTime()-7*86400000).toISOString().slice(0,10);
 for(const prefix of ['updates/','rate/']){
  let removed=0;
  for await(const page of store.list({prefix,paginate:true})){
   for(const b of page.blobs){if(b.key.split('/')[1]<cutoff){await store.delete(b.key);removed++}if(removed>=1000)break}
   if(removed>=1000)break;
  }
 }
}
module.exports={publish,cleanup};
