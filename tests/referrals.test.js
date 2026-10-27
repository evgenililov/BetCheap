'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {issue,verify,record,report}=require('../netlify/lib/referrals');
const secret='test-secret-not-production',now=Date.parse('2026-10-22T12:00:00Z');
test('public endpoint rejects unauthorized reports, cross-origin events and oversized bodies before storage',async()=>{
 const before=process.env.TELEGRAM_WEBHOOK_SECRET;process.env.TELEGRAM_WEBHOOK_SECRET='a'.repeat(64);
 try{
  const handler=(await import('../netlify/functions/referrals.mjs')).default;
  const request=(body,headers={})=>new Request('https://betcheap.netlify.app/.netlify/functions/referrals',{method:'POST',headers:{Origin:'https://betcheap.netlify.app',...headers},body:JSON.stringify(body)});
  assert.equal((await handler(request({action:'report',date:'2026-10-22'}))).status,401);
  assert.equal((await handler(request({action:'start',campaign:'championz',consent:true},{Origin:'https://evil.test'}))).status,403);
  assert.equal((await handler(request({action:'start',campaign:'unknown',consent:true}))).status,400);
  assert.equal((await handler(request({action:'start',campaign:'championz',consent:false}))).status,400);
  assert.equal((await handler(request({action:'event',token:'fake',type:'comparison'}))).status,400);
  assert.equal((await handler(request({padding:'x'.repeat(3000)}))).status,413);
  assert.equal((await handler(request({action:'report',date:'2026-02-31'},{'X-Telegram-Bot-Api-Secret-Token':process.env.TELEGRAM_WEBHOOK_SECRET}))).status,400);
 }finally{if(before===undefined)delete process.env.TELEGRAM_WEBHOOK_SECRET;else process.env.TELEGRAM_WEBHOOK_SECRET=before}
});
test('session signatures reject tampering, expired sessions and other secrets',()=>{
 const token=issue(secret,now),session=verify(token,secret,now);
 assert.equal(session.campaign,'championz');assert.equal(session.day,'2026-10-22');
 assert.equal(verify(token,'other',now),null);
 assert.equal(verify(token,secret,now+86400001),null);
 assert.equal(verify('x'+token,secret,now),null);
 assert.equal(verify(token+'.extra',secret,now),null);
});
test('events are deduplicated and never interpreted as customers or commission',async()=>{
 const records=new Map();const store={setJSON:async(key,value,options)=>{assert.equal(options.onlyIfNew,true);if(records.has(key))return {modified:false};records.set(key,value);return {modified:true}},list:async function*({prefix}){yield {blobs:[...records.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key}))}}};
 const session=verify(issue(secret,now),secret,now);
 await record(store,session,'visit');await record(store,session,'visit');await record(store,session,'comparison');await record(store,session,'cloudbet_click');
 await assert.rejects(record(store,session,'bet_placed'),/invalid_type/);
 const result=await report(store,'2026-10-22');assert.equal(result.counts.visit,1);assert.equal(result.counts.comparison,1);assert.equal(result.counts.cloudbet_click,1);
 assert.equal(result.qualifiedCustomers,null);assert.equal(result.commissionDue,null);assert.equal(result.operatorAttribution,'not_verified');
 assert.equal((await report(store,'2026-10-23')).counts.visit,0);
 await assert.rejects(report(store,'2026-02-31'),/invalid_date/);
});
test('X and Champion Z campaigns have separate signed sessions and report totals',async()=>{
 const records=new Map();const store={setJSON:async(key,value)=>records.set(key,value),list:async function*({prefix}){yield {blobs:[...records.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key}))}}};
 const x=verify(issue(secret,now,'betcheap_x'),secret,now),champion=verify(issue(secret,now,'championz'),secret,now);
 assert.equal(x.campaign,'betcheap_x');
 await record(store,x,'visit');await record(store,x,'comparison');await record(store,champion,'visit');
 assert.equal((await report(store,'2026-10-22','betcheap_x')).counts.comparison,1);
 assert.equal((await report(store,'2026-10-22','championz')).counts.comparison,0);
 assert.throws(()=>issue(secret,now,'../unknown'),/invalid_campaign/);
 await assert.rejects(report(store,'2026-10-22','unknown'),/invalid_campaign/);
});
