"use strict";
const {providerQuery,competitionMatch,matchingCompetition,matchingEvent,matchingDiagnostic,eventClock,sameEvent,extract1x2}=require('../lib/cloudbet-compare');
const {competitionCoverage}=require('../lib/competition-coverage');
const {catalogRows,fixturePage}=require('../lib/cloudbet-audit');
const URL_BASE='https://sports-api.cloudbet.com/pub/v2/odds';
const answer=(statusCode,payload)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'},body:JSON.stringify(payload)});
const clean=(v,max)=>typeof v==='string'&&v.length<=max?v.trim():'';
const getError=e=>{const status=Number(e?.httpStatus)||0;return {upstreamStatus:status||undefined,error:status===401||status===403?'cloudbet_auth_rejected':status===400?'cloudbet_bad_request':status===429?'cloudbet_rate_limited':e?.name==='AbortError'?'cloudbet_timeout':e?.message==='invalid_catalog_schema'||e?.message==='invalid_competition_schema'||e?.message==='invalid_event_schema'?'cloudbet_invalid_response':'cloudbet_feed_unavailable'}};
async function upstream(path,key,timeoutMs=10000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const r=await fetch(URL_BASE+path,{headers:{'Accept':'application/json','Content-Type':'application/json','X-API-Key':key},signal:controller.signal});if(!r.ok){const e=new Error('upstream_http');e.httpStatus=r.status;throw e;}return await r.json();}finally{clearTimeout(timer)}}
let catalogCache=null;let competitionCache=new Map();let eventCache=new Map();
function boundedPut(cache,k,v,ttl){if(cache.size>70)cache.clear();cache.set(k,{v,expires:Date.now()+ttl});return v;}
async function catalog(key){const now=Date.now();if(catalogCache?.key===key&&catalogCache.expires>now)return catalogCache.data;const data=await upstream('/sports/soccer',key);if(!Array.isArray(data?.categories))throw Error('invalid_catalog_schema');catalogCache={key,expires:now+120000,data};return data;}
async function competition(key,competitionKey,kind){const k=competitionKey+'|'+kind;const cached=competitionCache.get(k);if(kind!=='live'&&cached?.expires>Date.now())return cached.v;// Lightweight fixture discovery: do NOT request full-market payload for every event.
 // Cloudbet documents that competition lists omit markets by default.
 // Match the fixture first, then fetch only the matched event's full-time markets.
 const data=await upstream('/competitions/'+encodeURIComponent(competitionKey),key,14000);if(!Array.isArray(data?.events))throw Error('invalid_competition_schema');return kind==='live'?data:boundedPut(competitionCache,k,data,30000);}
async function individual(key,id,kind){const k=String(id)+'|'+kind,cached=eventCache.get(k);if(kind!=='live'&&cached?.expires>Date.now())return cached.v;if(!/^\d{1,16}$/.test(String(id)))throw Error('invalid_event_schema');let data=await upstream('/events/'+encodeURIComponent(String(id)),key);const e=data?.event||data;if(!e||typeof e!=='object'||!e.id)throw Error('invalid_event_schema');return kind==='live'?e:boundedPut(eventCache,k,e,25000);}
// Request only PUBLIC probe diagnostics. No API key, token, raw URL, personal data or provider payloads returned.
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return answer(405,{ok:false,error:'method_not_allowed'});
 const key=process.env.CLOUDBET_API_KEY;const op=event.queryStringParameters?.op||'status';
 if(op==='status')return answer(200,{ok:true,configured:!!key,provider:'Cloudbet Affiliate Feed API',verifiedLive:false,feedLagNotice:'Affiliate odds may be delayed up to 60 seconds.'});
 if(!key)return answer(503,{ok:false,error:'cloudbet_not_configured'});
 if(op==='fixtures'){
  const q=event.queryStringParameters||{},offsetText=q.offset||'0';
  if(typeof q.competitionKey!=='string'||!/^[-a-z0-9]{1,160}$/.test(q.competitionKey)||!/^\d{1,7}$/.test(offsetText))return answer(400,{ok:false,error:'invalid_audit_query'});
  let stage='catalog';
  try{
   const data=await catalog(key),rows=catalogRows(data),found=rows.filter(r=>r.key===q.competitionKey);
   if(found.length!==1)return answer(400,{ok:false,error:'competition_not_verified'});
   stage='competition';const fixtures=await competition(key,q.competitionKey,'prematch');
   return answer(200,{ok:true,scope:'fixture_names_only',marketsChecked:false,competition:found[0],generatedAt:new Date().toISOString(),...fixturePage(fixtures,Number(offsetText))});
  }catch(e){return answer(502,{ok:false,stage,...getError(e)});}
 }
 if(op==='coverage'){
  const kind=event.queryStringParameters?.kind||'all';
  if(!['all','prematch','live'].includes(kind))return answer(400,{ok:false,error:'invalid_kind'});
  const kinds=kind==='all'?['prematch','live']:[kind];
  let stage='catalog';
  try{
   const data=await catalog(key);stage='onexbet-catalog';
   const onexbet=require('./onexbet');
   const results=await Promise.all(kinds.map(async mode=>{
    const response=await onexbet.handler({httpMethod:'GET',queryStringParameters:{op:'tournaments',sportId:'1',kind:mode,lng:'en'}});
    if(response.statusCode!==200)return {kind:mode,ok:false,error:'onexbet_catalog_unavailable',status:response.statusCode};
    return {ok:true,...competitionCoverage(data,JSON.parse(response.body),mode)};
   }));
   const complete=results.every(r=>r.ok&&!r.possiblyTruncated);
   return answer(200,{ok:results.every(r=>r.ok),catalogComplete:complete,scope:'football_competition_catalogs',marketsChecked:false,cloudbetCatalog:catalogRows(data),generatedAt:new Date().toISOString(),results});
  }catch(e){return answer(502,{ok:false,stage,...(stage==='catalog'?getError(e):{error:'onexbet_catalog_invalid'})});}
 }
 if(op==='probe'){
  let stage='catalog';try{
   const data=await catalog(key),league=matchingCompetition(data,'England. Premier League');if(!league)return answer(200,{ok:true,authenticated:true,competitionFound:false});
   stage='competition';const fixture=await competition(key,league.key,'prematch');const withMarkets=fixture.events.filter(e=>!!extract1x2(e)).length;
   // A single event without a market does not prove the feed is empty.
   // Inspect a bounded number of unique tradable events and disclose only counts,
   // never raw upstream responses, IDs, personal data, or the API key.
   const candidates=fixture.events.filter(e=>e.id&&['TRADING','TRADING_LIVE'].includes(e.status)).slice(0,3);
   const diagnostics={checked:0,complete1x2:0,missingMarkets:0,incomplete1x2:0,detailErrors:0,marketKeySamples:[]};
   stage='individual';
   const checks=await Promise.all(candidates.slice(0,3).map(async candidate=>{
    try{const detail=await individual(key,candidate.id,candidate.status==='TRADING_LIVE'?'live':'prematch');
     return {ok:true,complete:Boolean(extract1x2(detail)),keys:Object.keys(detail.markets||{})};
    }catch{return {ok:false};}
   }));
   for(const item of checks){
    if(!item.ok){diagnostics.detailErrors++;continue}
    diagnostics.checked++;
    if(item.complete)diagnostics.complete1x2++;
    else if(!item.keys.length)diagnostics.missingMarkets++;
    else diagnostics.incomplete1x2++;
    for(const key of item.keys.filter(x=>/^soccer\.[a-zA-Z_]{3,50}$/.test(x)).slice(0,8))
     if(!diagnostics.marketKeySamples.includes(key)&&diagnostics.marketKeySamples.length<8)diagnostics.marketKeySamples.push(key);
   }
   return answer(200,{ok:true,authenticated:true,competitionFound:true,eventsReturned:fixture.events.length,eventsWithCompleteList1x2:withMarkets,individualEventChecked:diagnostics.checked>0,individualEvent1x2Available:diagnostics.complete1x2>0,detailStatus:!candidates.length?'no_eligible_event':diagnostics.complete1x2?'market_found':diagnostics.detailErrors===candidates.length?'detail_fetch_failed':'market_not_tradable',diagnostics});
  }catch(e){return answer(502,{ok:false,stage,...getError(e)});}
 }
 if(op!=='compare')return answer(400,{ok:false,error:'invalid_operation'});
 const q=event.queryStringParameters||{},home=clean(q.home,90),away=clean(q.away,90),league=clean(q.league,120),start=clean(q.start,40);
 if(!['prematch','live'].includes(q.kind)||q.sportId!=='1'||!home||!away||!league||!Number.isFinite(Date.parse(start)))return answer(400,{ok:false,error:'unsupported_comparison'});
 const startTime=Date.parse(start),now=Date.now();
 if(q.kind==='prematch'&&(startTime<=now+60000||startTime>now+30*864e5))return answer(200,{ok:true,matched:false,reason:'not_upcoming',provider:'Cloudbet'});
 if(q.kind==='live'&&(startTime>now+3*60000||startTime<now-24*3600000))return answer(200,{ok:true,matched:false,reason:'not_in_live_window',provider:'Cloudbet'});
 let stage='catalog';try{
  const data=await catalog(key),match=competitionMatch(data,league),comp=match.competition;if(!comp)return answer(200,{ok:true,matched:false,reason:'competition_not_verified',provider:'Cloudbet',diagnostic:{competitionFailure:match.reason,candidates:match.candidates}});
  stage='competition';const fixture=await competition(key,comp.key,q.kind);
  const query=providerQuery({home,away,start,kind:q.kind},league),matched=matchingEvent(fixture,query);
  if(!matched)return answer(200,{ok:true,matched:false,reason:'event_not_verified',provider:'Cloudbet',diagnostic:matchingDiagnostic(fixture,query)});
  let odds=null,source='event-detail';let verified=matched;
  // Always fetch the selected event's available markets, never all markets for an entire competition.
  stage='individual';verified=await individual(key,matched.id,q.kind);if(String(verified.id)!==String(matched.id)||!sameEvent(verified,query))return answer(200,{ok:true,matched:false,reason:'individual_event_mismatch',provider:'Cloudbet'});odds=extract1x2(verified);
  // Feed API documents an explicit markets filter; on a missing main market,
  // retry ONLY the verified event and ONLY the full-time match-odds market.
  // Keep the original event verification; never infer event IDs or invent odds.
  if(!odds){
   stage='event-market';
   let fallback;try{fallback=await upstream('/events/'+encodeURIComponent(String(matched.id))+'?markets=soccer.matchOdds',key,10000)}catch(e){if(e.httpStatus!==400)throw e;}
   if(fallback){const second=fallback?.event||fallback;
    if(String(second?.id)!==String(matched.id)||!sameEvent(second,query))return answer(200,{ok:true,matched:false,reason:'individual_event_mismatch',provider:'Cloudbet'});
    odds=extract1x2(second);if(odds)verified=second;}
  }
  if(!odds)return answer(200,{ok:true,matched:false,reason:'full_time_1x2_unavailable',provider:'Cloudbet',diagnostic:{marketKeyCount:Object.keys(verified.markets||{}).length,hasPrimaryKey:Boolean(verified.markets?.['soccer.match_odds']||verified.markets?.['soccer.matchOdds']),via:source}});
  const seenAt=new Date().toISOString();return answer(200,{ok:true,matched:true,kind:q.kind,provider:'Cloudbet',source:'Cloudbet Affiliate Feed API',retrieval:source,competition:comp.name,home:verified.home.name,away:verified.away.name,start:eventClock(verified).value,timeSource:eventClock(verified).source,cloudbetEventId:String(verified.id),odds,checkedAt:seenAt,feedNotice:'Cloudbet affiliate odds may be up to 60s delayed; timestamps are fetch times, not synchronized market times. Markets may suspend. No automatic bet placement or unverified referral routing.'});
 }catch(e){return answer(502,{ok:false,stage,...getError(e)});}
};
