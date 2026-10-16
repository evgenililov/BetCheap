'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {matchingDiagnostic,matchingEvent}=require('../netlify/lib/cloudbet-compare');
const now=Date.parse('2026-10-16T10:00:00Z');
const query={home:'Everton',away:'Chelsea',start:'2026-10-17T11:30:00Z',kind:'prematch'};
const event={id:987,status:'TRADING',startTime:query.start,home:{name:query.home},away:{name:query.away}};
const cases=[
 ['empty competition',[], 'empty_competition'],
 ['unreadable names',[{id:987,status:'TRADING',startTime:query.start}], 'team_names_unavailable'],
 ['different teams',[{...event,away:{name:'Arsenal'}}], 'team_pair_not_found'],
 ['reversed teams',[{...event,home:event.away,away:event.home}], 'team_pair_not_found'],
 ['different date',[{...event,startTime:'2026-10-18T11:30:00Z'}], 'start_time_mismatch'],
 ['invalid time',[{...event,startTime:'invalid'}], 'start_time_mismatch'],
 ['suspended fixture',[{...event,status:'SUSPENDED'}], 'trading_status_mismatch'],
 ['duplicate matching fixtures',[event,{...event,id:988}], 'ambiguous_event']
];
for(const [name,events,reason] of cases)test(name,()=>{
 const data={events};assert.equal(matchingEvent(data,query,now),null);
 const diagnostic=matchingDiagnostic(data,query,now);
 assert.equal(diagnostic.matchFailure,reason);
 const serialized=JSON.stringify(diagnostic);
 for(const privateField of ['Everton','Chelsea','987','startTime','SUSPENDED'])assert.ok(!serialized.includes(privateField));
});
test('matching diagnostics do not change matching behavior',()=>{
 assert.equal(matchingEvent({events:[event]},query,now),event);
 assert.equal(matchingDiagnostic({events:[event]},query,now).matchFailure,'none');
 assert.equal(matchingDiagnostic({events:[event]},query,now).verifiedCandidates,1);
 assert.equal(matchingDiagnostic({events:[{...event,startTime:'2026-10-18T11:30:00Z'}]},query,now).closestStartDeltaMinutes,1440);
 assert.equal(matchingDiagnostic({events:[{...event,home:event.away,away:event.home}]},query,now).reversedTeams,1);
});
test('HTTP comparison exposes aggregate failure reason, not raw provider payload',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.CLOUDBET_API_KEY;
 const start=new Date(Date.now()+86400000).toISOString();
 process.env.CLOUDBET_API_KEY='test-only-diagnostic-key';
 global.fetch=async url=>({ok:true,json:async()=>url.includes('/sports/')?
  {categories:[{name:'England',competitions:[{name:'Premier League',key:'soccer-england-premier-league'}]}]}:
  {events:[{...event,startTime:start,status:'SUSPENDED',privateMarker:'must-not-leak'}]}});
 try{
  const {handler}=require('../netlify/functions/cloudbet');
  const response=await handler({httpMethod:'GET',queryStringParameters:{op:'compare',sportId:'1',...query,start,league:'England. Premier League'}});
  const data=JSON.parse(response.body);
  assert.equal(response.statusCode,200);assert.equal(data.matched,false);
  assert.equal(data.diagnostic.matchFailure,'trading_status_mismatch');
  assert.equal(data.diagnostic.sameTeams,1);
  assert.ok(!response.body.includes('test-only-diagnostic-key'));assert.ok(!response.body.includes('must-not-leak'));
 }finally{
  global.fetch=oldFetch;
  if(oldKey===undefined)delete process.env.CLOUDBET_API_KEY;else process.env.CLOUDBET_API_KEY=oldKey;
 }
});
