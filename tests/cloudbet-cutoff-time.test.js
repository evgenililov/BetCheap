'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {eventClock,eventTimeOK,matchingEvent,matchingDiagnostic}=require('../netlify/lib/cloudbet-compare');
const fixedNow=Date.parse('2026-10-16T10:00:00Z');
const time='2026-10-17T11:30:00Z';
const fixture={id:101,status:'TRADING',home:{name:'Everton'},away:{name:'Chelsea'},cutoffTime:time};
const query={home:'Everton',away:'Chelsea',start:time,kind:'prematch'};
test('documented cutoffTime matches the same fixture without a legacy startTime',()=>{
 assert.equal(matchingEvent({events:[fixture]},query,fixedNow),fixture);
 assert.equal(eventClock(fixture).source,'cutoffTime');
 const diagnostic=matchingDiagnostic({events:[fixture]},query,fixedNow);
 assert.equal(diagnostic.eventsWithStartTime,0);
 assert.equal(diagnostic.eventsWithCutoffTime,1);
 assert.equal(diagnostic.eventsWithUsableTime,1);
 assert.equal(diagnostic.matchFailure,'none');
});
test('timestamp compatibility retains strict time and identity checks',()=>{
 assert.equal(eventClock({...fixture,startTime:time}).source,'startTime');
 assert.equal(eventClock({startTime:time}).source,'startTime');
 assert.equal(eventClock({...fixture,startTime:'2026-10-18T11:30:00Z'}),null);
 assert.equal(eventClock({cutoffTime:'invalid'}),null);
 assert.equal(eventClock({cutoffTime:1792236600}),null);
 assert.equal(eventClock({cutoffTime:'2026-10-17T11:30:00'}),null);
 assert.equal(matchingEvent({events:[fixture]},{...query,start:'2026-10-18T11:30:00Z'},fixedNow),null);
 assert.equal(matchingEvent({events:[fixture]},{...query,home:'Chelsea',away:'Everton'},fixedNow),null);
 assert.equal(eventTimeOK({...fixture,cutoffTime:'2026-10-16T09:40:00Z'},'2026-10-16T09:40:00Z','live',fixedNow),true);
 assert.equal(eventTimeOK({...fixture,cutoffTime:'2026-10-14T09:40:00Z'},'2026-10-14T09:40:00Z','live',fixedNow),false);
});
const markets={'soccer.match_odds':{submarkets:{'period=ft':{selections:['home','draw','away'].map((outcome,i)=>({outcome,price:[3.1,3.8,2.3][i],side:'BACK',status:'SELECTION_ENABLED',params:''}))}}}};
async function compare({kind='prematch',fallback=false,wrongDetailTime=false}={}){
 const savedFetch=global.fetch,savedKey=process.env.CLOUDBET_API_KEY;
 const start=new Date(Date.now()+(kind==='live'?-20*60000:24*3600000)).toISOString();
 const entry={...fixture,status:kind==='live'?'TRADING_LIVE':'TRADING',cutoffTime:start};
 const calls=[];
 process.env.CLOUDBET_API_KEY='test-only-cutoff-key';
 global.fetch=async url=>{
  calls.push(url);let data;
  if(url.endsWith('/sports/soccer'))data={categories:[{name:'England',competitions:[{name:'Premier League',key:'soccer-england-premier-league'}]}]};
  else if(url.includes('/competitions/'))data={events:[entry]};
  else if(url.includes('/events/101'))data={...entry,cutoffTime:wrongDetailTime?new Date(Date.parse(start)+86400000).toISOString():start,markets:fallback&&!url.includes('?markets=')?{}:markets};
  else throw Error('Unexpected endpoint');
  return {ok:true,json:async()=>data};
 };
 try{
  delete require.cache[require.resolve('../netlify/functions/cloudbet')];
  const {handler}=require('../netlify/functions/cloudbet');
  const response=await handler({httpMethod:'GET',queryStringParameters:{op:'compare',sportId:'1',...query,kind,start,league:'England. Premier League'}});
  assert.equal(response.statusCode,200);
  assert.ok(!response.body.includes('test-only-cutoff-key'));
  return {data:JSON.parse(response.body),calls,start};
 }finally{
  global.fetch=savedFetch;
  if(savedKey===undefined)delete process.env.CLOUDBET_API_KEY;else process.env.CLOUDBET_API_KEY=savedKey;
 }
}
for(const kind of ['prematch','live'])test('HTTP comparison accepts current '+kind+' feed time schema',async()=>{
 const {data,start}=await compare({kind});
 assert.equal(data.matched,true);assert.equal(data.kind,kind);
 assert.deepEqual(data.odds,{home:3.1,draw:3.8,away:2.3});
 assert.equal(data.start,start);assert.equal(data.timeSource,'cutoffTime');
});
test('market fallback uses the same validated cutoffTime event',async()=>{
 const {data,calls}=await compare({fallback:true});
 assert.equal(data.matched,true);assert.ok(calls.some(url=>url.endsWith('/events/101?markets=soccer.matchOdds')));
});
test('a different timestamp in individual event details is still rejected',async()=>{
 const {data}=await compare({wrongDetailTime:true});
 assert.equal(data.matched,false);assert.equal(data.reason,'individual_event_mismatch');
});
