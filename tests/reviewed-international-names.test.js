'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {providerQuery,matchingEvent}=require('../netlify/lib/cloudbet-compare');
const evidence=require('./fixtures/reviewed-name-evidence.json');
test('all observed international spellings match only the correct fixture',()=>{
 const start=new Date(Date.now()+86400000).toISOString();
 for(const row of evidence){
  const q={home:row.home,away:row.away,start,kind:'prematch'};
  const e={status:'TRADING',cutoffTime:start,home:{name:row.providerHome},away:{name:row.providerAway}};
  const mapped=providerQuery(q,row.league);
  assert.equal(matchingEvent({events:[e]},mapped),e,JSON.stringify(row));
  assert.equal(matchingEvent({events:[e,e]},mapped),null);
  assert.equal(matchingEvent({events:[{...e,status:'SUSPENDED'}]},mapped),null);
  assert.equal(matchingEvent({events:[{...e,home:e.away,away:e.home}]},mapped),null);
  assert.equal(matchingEvent({events:[{...e,cutoffTime:new Date(Date.now()+3*86400000).toISOString()}]},mapped),null);
  for(const side of ['home','away'])for(const suffix of [' Women',' U19',' II']){
   const name=q[side]+suffix;assert.equal(providerQuery({...q,[side]:name},row.league)[side],name);
  }
  assert.deepEqual(providerQuery(q,'Other. League'),q);
 }
});
test('actual backend applies every reviewed name to list and detail',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.CLOUDBET_API_KEY;
 const start=new Date(Date.now()+86400000).toISOString();
 const events=evidence.map((r,i)=>({id:5000+i,status:'TRADING',cutoffTime:start,home:{name:r.providerHome},away:{name:r.providerAway}}));
 const markets={'soccer.match_odds':{submarkets:{'period=ft':{selections:['home','draw','away'].map((outcome,i)=>({outcome,price:2+i,side:'BACK',status:'SELECTION_ENABLED'}))}}}};
 const leagues=[...new Set(evidence.map(r=>r.league))];
 const categories=leagues.map((l,i)=>({name:l.split('. ')[0],competitions:[{name:l.split('. ').slice(1).join('. '),key:'league-'+i}]}));
 process.env.CLOUDBET_API_KEY='test-only';
 global.fetch=async url=>({ok:true,json:async()=>{
  if(url.endsWith('/sports/soccer'))return {categories};
  if(url.includes('/competitions/')){const league=leagues[Number(url.split('-').pop())];return {events:events.filter((e,i)=>evidence[i].league===league)};}
  return {...events[Number(new URL(url).pathname.split('/').pop())-5000],markets};
 }});
 try{
  const handler=require('../netlify/functions/cloudbet').handler;
  for(const r of evidence){
   const response=await handler({httpMethod:'GET',queryStringParameters:{op:'compare',kind:'prematch',sportId:'1',league:r.league,home:r.home,away:r.away,start}});
   const body=JSON.parse(response.body);assert.equal(body.matched,true,JSON.stringify({r,body}));assert.deepEqual(body.odds,{home:2,draw:3,away:4});
  }
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.CLOUDBET_API_KEY;else process.env.CLOUDBET_API_KEY=oldKey;}
});
