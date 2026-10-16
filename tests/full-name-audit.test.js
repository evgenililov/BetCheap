'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const audit=require('./fixtures/full-name-audit.json');
const {competitionMatch,providerQuery,matchingEvent,normalize}=require('../netlify/lib/cloudbet-compare');
const routes=require('../netlify/lib/reviewed-competition-routes.json');
const names=require('../netlify/lib/reviewed-fixture-names.json');
const categories=[];
for(const row of audit.catalog){let c=categories.find(c=>c.name===row.country);if(!c){c={name:row.country,competitions:[]};categories.push(c);}c.competitions.push({key:row.key,name:row.name});}
const catalog={categories};let id=10000;
const lists=Object.fromEntries(Object.entries(audit.competitions).map(([key,rows])=>[key,{events:rows.map(e=>({id:id++,status:e.status,cutoffTime:e.start,home:{name:e.home},away:{name:e.away}}))}]));
const makeQuery=r=>({kind:r.kind,league:r.tournament,home:r.home,away:r.away,start:new Date(r.start*1000).toISOString()});
test('every reviewed fixture matches the complete observed provider lists uniquely',()=>{
 for(const r of audit.approved){
  const query=makeQuery(r),match=competitionMatch(catalog,r.tournament);
  assert.ok(match.competition,r.tournament);
  const comps=match.competitions||[match.competition];
  assert.ok(comps.some(c=>c.key===r.provider.key),r.tournament);
  const events=comps.flatMap(c=>lists[c.key].events);
  const q=providerQuery(query,r.tournament),now=r.start*1000+(r.kind==='live'?1200000:-3600000);
  const found=matchingEvent({events},q,now);
  assert.ok(found,JSON.stringify(r));assert.equal(found.home.name,r.providerHome);assert.equal(found.away.name,r.providerAway);
  assert.equal(matchingEvent({events:[found,found]},q,now),null);
  assert.equal(matchingEvent({events:[{...found,home:found.away,away:found.home}]},q,now),null);
  assert.equal(matchingEvent({events:[{...found,status:'SUSPENDED'}]},q,now),null);
  assert.equal(matchingEvent({events:[{...found,cutoffTime:new Date(r.start*1000+86400000).toISOString()}]},q,now),null);
 }
});
test('every registry entry has reviewed evidence and preserves exact scopes',()=>{
 for(const [scope,aliases] of Object.entries(names))for(const [from,to] of Object.entries(aliases)){
  assert.ok(audit.approved.some(r=>normalize(r.tournament)===scope&&['home','away'].some(side=>normalize(r[side])===from&&r['provider'+(side==='home'?'Home':'Away')]===to)),scope+' '+from);
  for(const suffix of [' Unknown U17',' Unreviewed Women',' Unreviewed II'])assert.equal(providerQuery({home:from+suffix},scope).home,from+suffix);
  assert.equal(providerQuery({home:from},'Unreviewed. League').home,from);
 }
 for(const [scope,entries] of Object.entries(routes)){
  assert.ok(entries.length<=4);assert.equal(new Set(entries.map(e=>e.key)).size,entries.length);
  const broken=structuredClone(catalog);
  for(const c of broken.categories)for(const t of c.competitions)if(t.key===entries[0].key)t.name+=' Unreviewed';
  assert.equal(competitionMatch(broken,scope).competition,null);
  assert.equal(competitionMatch(catalog,scope+' Unreviewed U17').competition,null);
 }
 assert.equal(providerQuery({home:'Mohun Bagan Super Giant'},'India. Super League').home,'Mohun Bagan Super Giant');
 assert.equal(providerQuery({home:'Karvina'},'Czech Republic. 2 Liga').home,'Karvina');
 assert.equal(providerQuery({home:'Al-Shorta Damascus'},'Syria. Premier League').home,'Al-Shorta Damascus');
 for(const [league,home] of [['England. League Two','Exeter City'],['USA. USL','Brooklyn FC'],['South Africa. 1st Division','Cape Town City'],['Kazakhstan. Premier League','Altay Ust-Kamenogorsk']])assert.equal(providerQuery({home},league).home,home);
 for(const league of ['Spain. La Liga. Team vs Player','Austria. BFV. Landesliga','Jordan. Shield Cup U21','Indonesia. Championship'])assert.equal(competitionMatch(catalog,league).competition,null);
});
test('backend replays all reviewed fixtures, including countryless cups and split groups',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.CLOUDBET_API_KEY,oldNow=Date.now;
 process.env.CLOUDBET_API_KEY='audit-fixture-key';
 const events=Object.values(lists).flatMap(x=>x.events);
 const markets={'soccer.match_odds':{submarkets:{'period=ft':{selections:['home','draw','away'].map((outcome,i)=>({outcome,price:2+i,side:'BACK',status:'SELECTION_ENABLED'}))}}}};
 global.fetch=async url=>({ok:true,json:async()=>{
  if(url.endsWith('/sports/soccer'))return catalog;
  if(url.includes('/competitions/')){const key=url.split('/').pop();assert.ok(lists[key],key);return lists[key];}
  const event=events.find(e=>String(e.id)===new URL(url).pathname.split('/').pop());assert.ok(event,url);return {...event,markets};
 }});
 try{
  const {handler}=require('../netlify/functions/cloudbet');
  for(const r of audit.approved){
   Date.now=()=>r.start*1000+(r.kind==='live'?1200000:-3600000);
   const res=await handler({httpMethod:'GET',queryStringParameters:{op:'compare',sportId:'1',...makeQuery(r)}}),body=JSON.parse(res.body);
   assert.equal(body.matched,true,JSON.stringify({r,body}));assert.equal(body.home,r.providerHome);assert.equal(body.away,r.providerAway);assert.deepEqual(body.odds,{home:2,draw:3,away:4});
  }
 }finally{Date.now=oldNow;global.fetch=oldFetch;if(oldKey===undefined)delete process.env.CLOUDBET_API_KEY;else process.env.CLOUDBET_API_KEY=oldKey;}
});
test('split groups reject ambiguous events and incomplete upstream results',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.CLOUDBET_API_KEY;
 const start=new Date(Date.now()+86400000).toISOString();
 const groupRoutes=routes['czech republic 3 liga'];assert.equal(groupRoutes.length,2);
 const groupCatalog={categories:[{name:'Czechia',competitions:groupRoutes.map(r=>({key:r.key,name:r.name}))}]};
 let fail=false,details=0;
 global.fetch=async url=>{
  if(url.includes('/events/'))details++;
  if(fail&&url.endsWith(groupRoutes[1].key))return {ok:false,status:503};
  return {ok:true,json:async()=>url.endsWith('/sports/soccer')?groupCatalog:{events:[{id:url.endsWith(groupRoutes[0].key)?1:2,status:'TRADING',cutoffTime:start,home:{name:'Fixture Home'},away:{name:'Fixture Away'}}]}};
 };
 process.env.CLOUDBET_API_KEY='split-group-test';
 const query={op:'compare',kind:'prematch',sportId:'1',league:'Czech Republic. 3 Liga',home:'Fixture Home',away:'Fixture Away',start};
 try{
  for(const unavailable of [false,true]){
   fail=unavailable;delete require.cache[require.resolve('../netlify/functions/cloudbet')];
   const res=await require('../netlify/functions/cloudbet').handler({httpMethod:'GET',queryStringParameters:query}),body=JSON.parse(res.body);
   if(fail){assert.equal(res.statusCode,502);assert.equal(body.stage,'competition');}
   else {assert.equal(body.reason,'event_not_verified');assert.equal(body.diagnostic.matchFailure,'ambiguous_event');}
  }
  assert.equal(details,0);
  assert.equal(competitionMatch(catalog,'constructor').competition,null);
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.CLOUDBET_API_KEY;else process.env.CLOUDBET_API_KEY=oldKey;}
});
