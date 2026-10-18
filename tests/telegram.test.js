'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
process.env.TELEGRAM_WEBHOOK_SECRET='a'.repeat(48);process.env.TELEGRAM_BOT_TOKEN='test-token';
const s=require('../netlify/lib/telegram-service');
const odds=require('../netlify/lib/telegram-odds');
const {publish}=require('../netlify/lib/telegram-publisher');
function store(){const map=new Map();return {map,async get(k){return map.get(k)||null},async setJSON(k,v,o={}){if(o.onlyIfNew&&map.has(k))return {modified:false};map.set(k,v);return {modified:true}}}}
const update=(text='/start')=>({update_id:5,message:{date:Math.floor(Date.now()/1000),chat:{id:1,type:'private'},from:{id:1,is_bot:false},text}});
const request=u=>({httpMethod:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':process.env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify(u)});
const fixture=()=>({sportEventId:123,tournamentId:88637,sportId:1,type:1,period:0,home:'Arsenal',away:'Leeds United',tournament:'England. Premier League',start:Math.floor(Date.now()/1000)+3600,odds:[{type:9,parameter:2.5,oddsMarket:1.9}],subGames:[]});
const quote=()=>({ok:true,matched:true,cloudbetEventId:'456',checkedAt:new Date().toISOString(),markets:[{period:'ft',market:'total',line:2.5,outcome:'over',price:2.1}]});
test('auth and parser reject forgery, groups, other bots, old updates and malformed input',()=>{
 assert(s.authorized(request(update())));assert(!s.authorized({...request(update()),headers:{}}));
 assert.equal(s.command(update('/start@OtherBot')),null);assert.equal(s.command(update('/start@BetCheapBot')).name,'start');
 assert.equal(s.command({...update(),message:{...update().message,chat:{id:1,type:'group'}}}),null);
 assert.equal(s.command({...update(),message:{...update().message,date:1}}),null);
 assert.throws(()=>s.parse({...request(update()),body:'x'.repeat(17000)}));
});
test('webhook waits for accepted background enqueue, ignores channel posts, never calls Telegram directly',async()=>{
 const fn=require('../netlify/functions/telegram').handler;let calls=[];
 global.fetch=async(url,options)=>{calls.push({url,options});return {status:202}};
 assert.equal((await fn({...request(update()),headers:{}})).statusCode,401);assert.equal(calls.length,0);
 assert.equal((await fn(request({update_id:7,channel_post:{text:'/start'}}))).statusCode,200);assert.equal(calls.length,0);
 assert.equal((await fn(request(update()))).statusCode,200);assert.equal(calls.length,1);assert.match(calls[0].url,/telegram-process-background$/);
 global.fetch=async()=>({status:500});assert.equal((await fn(request(update()))).statusCode,503);
});
test('matches use genuine feed IDs and compare only common fresh lines',async()=>{
 const call=async(provider,q)=>provider==='cloudbet'?quote():q.op==='events'?{items:['123']}:{event:fixture(),fetchedAt:new Date().toISOString()};
 const events=await odds.matches(call);assert.equal(events.length,1);
 const listing=await odds.commandReply({name:'matches'},call);assert.match(listing.text,/\/compare 123/);assert.match(listing.text,/not yet verified/);
 const p=await odds.commandReply({name:'compare',arg:'123'},call);assert.match(p.text,/1xBet 1.90 \| Cloudbet 2.10/);assert.match(p.reply_markup.inline_keyboard[0][0].url,/eventId=123/);
 assert.equal(await odds.comparison(events[0],async()=>({...quote(),matched:false})),null);
 assert.equal(await odds.comparison(events[0],async()=>({...quote(),markets:[{...quote().markets[0],line:3.5}]})),null);
 assert.equal(await odds.comparison(events[0],async()=>({...quote(),checkedAt:'2020-01-01'})),null);
 assert.equal(await odds.comparison({...events[0],telegramFetchedAt:1},async()=>quote()),null);
 assert.match((await odds.commandReply({name:'compare',arg:'https://evil.test'},call)).text,/Use \/matches/);
});
test('persistent update claim prevents duplicate and concurrent sends',async()=>{
 const db=store(),originalStorage=s.storage,originalSend=s.send;s.storage=()=>db;let sent=0;s.send=async()=>{sent++;return {message_id:10}};
 try{const fn=require('../netlify/lib/telegram-process-background-handler').handler;await Promise.all([fn(request(update())),fn(request(update()))]);assert.equal(sent,1);
 await fn(request({...update(),update_id:6}));assert.equal(sent,1,'chat rate limit');}
 finally{s.storage=originalStorage;s.send=originalSend}
});
test('publisher is opt-in, sends only verified payloads, and never repeats an uncertain delivery',async()=>{
 const db=store();let sent=0;
 const deps={matches:async()=>[fixture()],comparison:async()=>({text:'verified fixture'}),send:async(chat)=>{assert.equal(chat,'@BetCheapOdds');sent++;return {message_id:12}}};
 assert.equal((await publish(db,deps)).state,'disabled');assert.equal(sent,0);
 await db.setJSON('settings',{publishingEnabled:true});
 const r=await Promise.all([publish(db,deps),publish(db,deps)]);assert.equal(sent,1);assert(r.some(x=>x.state==='already_attempted'));
 const db2=store();await db2.setJSON('settings',{publishingEnabled:true});assert.equal((await publish(db2,{...deps,comparison:async()=>null})).state,'no_verified_comparison');assert.equal(sent,1);
 const db3=store();await db3.setJSON('settings',{publishingEnabled:true});const uncertain={...deps,send:async()=>{sent++;throw Error('timeout')}};
 assert.equal((await publish(db3,uncertain)).state,'delivery_unknown');assert.equal((await publish(db3,uncertain)).state,'already_attempted');assert.equal(sent,2);
});
test('admin validates bot identity and channel rights; activation registers webhook but does not post',async()=>{
 const fn=require('../netlify/lib/telegram-admin-handler').handler,db=store(),original=s.storage;s.storage=()=>db;
 Object.assign(process.env,{ONEXBET_CLIENT_ID:'fixture',ONEXBET_CLIENT_SECRET:'fixture',ONEXBET_REF:'1',CLOUDBET_API_KEY:'fixture'});
 let calls=[],canPost=false,wrongBot=true;
 global.fetch=async(url,opts)=>{const method=url.split('/').pop();calls.push(method);return {ok:true,json:async()=>({ok:true,result:method==='getMe'?{id:99,username:wrongBot?'OtherBot':'BetCheapBot'}:method==='getChatMember'?{status:'administrator',can_post_messages:canPost}:true})}};
 try{
 assert.equal((await fn(request({action:'activate'}))).statusCode,409);wrongBot=false;
 assert.equal((await fn(request({action:'activate'}))).statusCode,409);canPost=true;
 const r=await fn(request({action:'activate'}));assert.equal(r.statusCode,200);assert(calls.includes('setWebhook'));assert(!calls.includes('sendMessage'));assert.equal((await db.get('settings')).publishingEnabled,true);assert(!r.body.includes('test-token'));
 await fn(request({action:'pause'}));assert.equal((await db.get('settings')).publishingEnabled,false);
 }finally{s.storage=original}
});
test('public status distinguishes configuration errors without revealing secret data',async()=>{
 const fn=require('../netlify/functions/telegram').handler,previous=process.env.TELEGRAM_WEBHOOK_SECRET;
 try{
  for(const [value,expected] of [['','missing'],['fixture-short','invalid_length'],['x'.repeat(64)+' ','invalid_characters'],['x'.repeat(64),'valid']]){
   process.env.TELEGRAM_WEBHOOK_SECRET=value;
   const r=await fn({httpMethod:'GET'}),data=JSON.parse(r.body);
   assert.equal(data.webhookSecretStatus,expected);assert.equal(data.webhookSecretConfigured,expected==='valid');
   if(value)assert(!r.body.includes(value));
  }
 }finally{process.env.TELEGRAM_WEBHOOK_SECRET=previous}
});
test('admin failures identify the stage without reflecting Telegram descriptions or tokens',async()=>{
 const fn=require('../netlify/lib/telegram-admin-handler').handler,db=store(),original=s.storage;s.storage=()=>db;
 try{
  global.fetch=async()=>({ok:false,status:401,json:async()=>({ok:false,error_code:401,description:'Unauthorized test-token'})});
  let r=await fn(request({action:'status'})),d=JSON.parse(r.body);assert.equal(d.stage,'bot_identity');assert.equal(d.reason,'telegram_token_rejected');assert(!r.body.includes('test-token'));
  global.fetch=async url=>({ok:true,json:async()=>url.endsWith('getMe')?{ok:true,result:{id:99,username:'BetCheapBot'}}:{ok:false,error_code:400,description:'Bad Request: chat not found'}});
  d=JSON.parse((await fn(request({action:'status'}))).body);assert.equal(d.stage,'channel_membership');assert.equal(d.reason,'telegram_channel_not_found');
  s.storage=()=>{const e=new Error('secret storage details');e.name='MissingBlobsEnvironmentError';throw e};
  r=await fn(request({action:'status'}));d=JSON.parse(r.body);assert.equal(d.stage,'storage_init');assert.equal(d.reason,'blobs_environment_missing');assert(!r.body.includes('secret storage details'));
 }finally{s.storage=original}
});
test('public health probe only reads state, caches concurrent requests and strips metadata',async()=>{
 const {default:health}=await import('../netlify/functions/telegram-health.mjs');
 const db=store(),original=s.storage;s.storage=()=>db;const calls=[];
 global.fetch=async url=>{const method=url.split('/').pop();calls.push(method);return {ok:true,json:async()=>({ok:true,result:method==='getMe'?{id:99,username:'BetCheapBot'}:method==='getChatMember'?{status:'administrator',can_post_messages:true}:{url:s.APP+'/.netlify/functions/telegram',pending_update_count:999}})}};
 try{
  assert.equal((await health(new Request('https://example.test',{method:'POST'}))).status,405);assert.equal(calls.length,0);
  const [a,b]=await Promise.all([health(new Request('https://example.test')),health(new Request('https://example.test'))]);
  const d=await a.json();assert.equal(d.canPost,true);assert.equal(d.webhookCorrect,true);assert.equal(d.publishingEnabled,false);assert(!('pendingUpdates' in d));assert(!JSON.stringify(d).includes('test-token'));assert.equal(b.status,200);
  assert.deepEqual(calls,['getMe','getChatMember','getWebhookInfo']);
 }finally{s.storage=original}
});
