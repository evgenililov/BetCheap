'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {matchingCompetition,competitionMatch}=require('../netlify/lib/cloudbet-compare');
const {competitionCoverage}=require('../netlify/lib/competition-coverage');
const catalog={categories:[
 {name:'International',competitions:[{name:'UEFA Champions League',key:'soccer-international-champions-league'},{name:'UEFA Europa League',key:'soccer-international-europa-league'}]},
 {name:'Spain',competitions:[{name:'La Liga',key:'soccer-spain-la-liga'}]},
 {name:'England',competitions:[{name:'Premier League',key:'soccer-england-premier-league'}]},
 {name:'Australia',competitions:[{name:'A-League',key:'soccer-australia-a-league'}]}
]};
test('country-less Champions League and Europa League are matched by full unique provider name',()=>{
 assert.equal(matchingCompetition(catalog,'UEFA Champions League').key,'soccer-international-champions-league');
 assert.equal(matchingCompetition(catalog,'UEFA Europa League').key,'soccer-international-europa-league');
});
test('country restrictions, qualifiers, and ambiguous competition names stay strict',()=>{
 assert.ok(matchingCompetition(catalog,'Spain. La Liga'));
 assert.ok(matchingCompetition(catalog,'Australia. A League'));
 assert.equal(matchingCompetition(catalog,'Spain. Premier League'),null);
 for(const name of ['UEFA Champions League Women','UEFA Champions League U19','UEFA Champions League. Winner','UEFA Champions League SRL'])assert.equal(matchingCompetition(catalog,name),null);
 const duplicate={categories:[...catalog.categories,{name:'Another category',competitions:[{name:'UEFA Champions League',key:'another-champions-league'}]}]};
 assert.equal(competitionMatch(duplicate,'UEFA Champions League').reason,'ambiguous_competition');
});
test('coverage includes every supplied row and distinguishes mappings from real odds',()=>{
 const result=competitionCoverage(catalog,{ok:true,reportedCount:7,possiblyTruncated:true,items:[
  {tournamentId:1,tournamentNameLocalization:'UEFA Champions League'},
  {tournamentId:2,tournamentNameLocalization:'Spain. La Liga'},
  {tournamentId:3,tournamentNameLocalization:'Spain. Premier League'},
  {tournamentId:4,tournamentNameLocalization:'Unknown. League'},
  {tournamentId:5,tournamentNameLocalization:'UEFA Champions League Women'},
  {privateKey:'never-expose'}
 ]},'prematch');
 assert.equal(result.total,6);assert.equal(result.competitions.length,6);
 assert.equal(result.counts.matched,2);assert.equal(result.counts.invalid_provider_entry,1);
 assert.equal(result.possiblyTruncated,true);assert.equal(result.reportedCount,7);assert.equal(result.marketsChecked,false);
 assert.ok(!JSON.stringify(result).includes('never-expose'));
});
test('coverage reports both modes through the function without per-event provider requests',async()=>{
 const onexbet=require('../netlify/functions/onexbet'),oldHandler=onexbet.handler,oldFetch=global.fetch,oldKey=process.env.CLOUDBET_API_KEY;
 let catalogRequests=0;const modes=[];
 process.env.CLOUDBET_API_KEY='test-only-coverage-key';
 global.fetch=async url=>{assert.ok(url.endsWith('/sports/soccer'));catalogRequests++;return {ok:true,json:async()=>catalog}};
 onexbet.handler=async e=>{modes.push(e.queryStringParameters.kind);return {statusCode:200,body:JSON.stringify({ok:true,items:[{tournamentId:1,tournamentNameLocalization:'UEFA Champions League'}]})}};
 try{
  delete require.cache[require.resolve('../netlify/functions/cloudbet')];
  const {handler}=require('../netlify/functions/cloudbet');
  let response=await handler({httpMethod:'GET',queryStringParameters:{op:'coverage'}}),data=JSON.parse(response.body);
  assert.equal(response.statusCode,200);assert.equal(data.ok,true);assert.equal(data.catalogComplete,true);assert.equal(data.marketsChecked,false);
  assert.equal(data.results.length,2);assert.deepEqual(modes,['prematch','live']);assert.equal(catalogRequests,1);
  assert.ok(data.results.every(r=>r.counts.matched===1));assert.ok(!response.body.includes('test-only-coverage-key'));
  onexbet.handler=async()=>({statusCode:503,body:'do-not-expose-provider-error'});
  response=await handler({httpMethod:'GET',queryStringParameters:{op:'coverage',kind:'live'}});data=JSON.parse(response.body);
  assert.equal(data.ok,false);assert.equal(data.catalogComplete,false);assert.equal(data.results[0].status,503);assert.ok(!response.body.includes('do-not-expose'));
 }finally{
  onexbet.handler=oldHandler;global.fetch=oldFetch;
  if(oldKey===undefined)delete process.env.CLOUDBET_API_KEY;else process.env.CLOUDBET_API_KEY=oldKey;
 }
});
