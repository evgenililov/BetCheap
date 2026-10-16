"use strict";
// Provider-grounded match and FULL TIME 1X2 matching. Never manufacture odds or cross-map teams.
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/ł/g,'l').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const CLUB_WORDS=new Set(['fc','afc','sc','cf','sv','vfb','fk','fkf','football','club']);
const coreName=v=>normalize(v).split(' ').filter(x=>!CLUB_WORDS.has(x)).join(' ');
function sameTeam(a,b){const n1=normalize(a),n2=normalize(b);if(!n1||!n2)return false;return n1===n2||(coreName(a).length>=4&&coreName(a)===coreName(b));}
function leagueParts(s){const parts=String(s||'').split(/\s*[.]\s*/).filter(Boolean);return parts.length>=2?{country:normalize(parts[0]),league:normalize(parts.slice(1).join(' '))}:null;}
function competitionName(country,name){
 const value=normalize(name);
 // Confirmed against the same Braga–Gil Vicente fixture in both feeds on 2026-10-16.
 if(country==='portugal'&&['primeira liga','liga portugal'].includes(value))return 'liga portugal';
 if(country==='bulgaria'&&['first league','parva liga'].includes(value))return 'parva liga';
 return value;
}
const providerTeamNames=new Map([
 ['spain|la liga',new Map([['deportivo de a coruna','RC Deportivo La Coruna']])],
 ['netherlands|eredivisie',new Map([['excelsior','Excelsior Rotterdam']])],
 ['germany|bundesliga',new Map([['1 koln','FC Koln']])],
 // Reviewed against opponents and kickoff times on 2026-10-16.
 ['bulgaria|parva liga',new Map([
  ['cska sofia 1948','CSKA 1948 Sofia'],
  ['dunav ruse','FC Dunav 2010'],
  ['spartak varna','FK Spartak 1918 Varna'],
  ['botev vratsa','POFC Botev Vratsa'],
  ['lokomotiv plovdiv','PFC Lokomotiv Plovdiv'],
  ['slavia sofia','PFC Slavia Sofia'],
  ['cska sofia','PFC CSKA Sofia'],
  ['ludogorets 1945','PFC Ludogorets 1945 Razgrad'],
  ['cherno more varna','PFC Cherno More Varna'],
  ['levski sofia','PFC Levski Sofia']
 ])]
]);
function providerQuery(query,league){
 const parts=leagueParts(league);
 const aliases=parts&&providerTeamNames.get(parts.country+'|'+competitionName(parts.country,parts.league));
 if(!aliases)return {...query};
 // Exact observed source names only, scoped to their competition. Qualifiers stay intact.
 return {...query,home:aliases.get(normalize(query.home))||query.home,away:aliases.get(normalize(query.away))||query.away};
}
function competitionMatch(data,league){
 const fullName=normalize(league),expected=leagueParts(league);
 if(!fullName)return {competition:null,reason:'invalid_competition_name',candidates:0};
 const found=[];let countries=0;
 for(const category of data?.categories||[]){
  if(expected&&normalize(category.name)!==expected.country)continue;
  countries++;
  for(const c of category.competitions||[]){
   if((expected?competitionName(expected.country,c.name):normalize(c.name))!==(expected?competitionName(expected.country,expected.league):fullName)||typeof c.key!=='string'||!/^[a-z0-9-]+$/.test(c.key))continue;
   found.push(c);
  }
 }
 // Country-less names such as UEFA Champions League must match the complete
 // provider name uniquely. Never drop Women/U19/Reserve/Winner/SRL qualifiers.
 if(found.length===1)return {competition:found[0],reason:'matched',candidates:1};
 return {competition:null,reason:found.length?'ambiguous_competition':expected&&!countries?'country_not_found':'competition_not_found',candidates:found.length};
}
function matchingCompetition(data,league){return competitionMatch(data,league).competition;}
function eventKindOK(e,kind){return e?.status===(kind==='live'?'TRADING_LIVE':'TRADING')}
// Current Cloudbet Feed protobuf exposes cutoff_time, encoded as cutoffTime by protojson.
// https://github.com/cloudbet/docs/blob/c3024e079db1d64684f742fbf7e26663aa3d8d36/cloudbet/feed.proto
// Older response examples also contain startTime. Keep its compatibility, without
// accepting conflicting timestamps or treating the provider cutoff as an unchecked kickoff.
function eventClock(e){
 const times=['startTime','cutoffTime'].flatMap(source=>{
  const value=e?.[source];
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return [];
  const ms=Date.parse(value);return Number.isFinite(ms)?[{source,value,ms}]:[];
 });
 if(!times.length||(times.length===2&&Math.abs(times[0].ms-times[1].ms)>15*60000))return null;
 return times[0];
}
function eventTimeOK(e,start,kind,now=Date.now()){
 const a=Date.parse(start),clock=eventClock(e),b=clock?.ms;if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>15*60*1000)return false;
 if(kind==='live'&&(b>now+3*60000||b<now-24*3600000))return false;
 if(kind==='prematch'&&b<=now+60000)return false;
 return true;
}
function sameEvent(e,q,now=Date.now()){
 if(!e||!['live','prematch'].includes(q.kind||'prematch')||!eventKindOK(e,q.kind||'prematch')||!eventTimeOK(e,q.start,q.kind||'prematch',now))return false;
 return sameTeam(e.home?.name,q.home)&&sameTeam(e.away?.name,q.away);
}
function matchingEvent(data,query,now=Date.now()){const found=(data?.events||[]).filter(e=>sameEvent(e,query,now));return found.length===1?found[0]:null;}
// Explain a failed match with aggregate counts only. No raw fixtures, IDs or credentials.
function matchingDiagnostic(data,query,now=Date.now()){
 const events=Array.isArray(data?.events)?data.events:[];
 const named=events.filter(e=>typeof e?.home?.name==='string'&&typeof e?.away?.name==='string');
 const sameTeams=named.filter(e=>sameTeam(e.home.name,query.home)&&sameTeam(e.away.name,query.away));
 const kind=query.kind||'prematch';
 const sameTeamsAndTime=sameTeams.filter(e=>eventTimeOK(e,query.start,kind,now));
 const verifiedCandidates=sameTeamsAndTime.filter(e=>eventKindOK(e,kind));
 const deltas=sameTeams.map(e=>Math.abs(eventClock(e)?.ms-Date.parse(query.start))/60000).filter(Number.isFinite);
 let matchFailure='none';
 if(!events.length)matchFailure='empty_competition';
 else if(!named.length)matchFailure='team_names_unavailable';
 else if(!sameTeams.length)matchFailure='team_pair_not_found';
 else if(!sameTeamsAndTime.length)matchFailure='start_time_mismatch';
 else if(!verifiedCandidates.length)matchFailure='trading_status_mismatch';
 else if(verifiedCandidates.length>1)matchFailure='ambiguous_event';
 return {eventsSeen:events.length,eventsWithTeamNames:named.length,
  eventsWithStartTime:events.filter(e=>Number.isFinite(Date.parse(e?.startTime))).length,
  eventsWithCutoffTime:events.filter(e=>Number.isFinite(Date.parse(e?.cutoffTime))).length,
  eventsWithUsableTime:events.filter(e=>eventClock(e)!==null).length,
  homeNameMatches:named.filter(e=>sameTeam(e.home.name,query.home)).length,
  awayNameMatches:named.filter(e=>sameTeam(e.away.name,query.away)).length,
  sameTeams:sameTeams.length,sameTeamsAndTime:sameTeamsAndTime.length,
  sameTeamsAndStatus:sameTeams.filter(e=>eventKindOK(e,kind)).length,
  reversedTeams:named.filter(e=>sameTeam(e.home.name,query.away)&&sameTeam(e.away.name,query.home)).length,
  verifiedCandidates:verifiedCandidates.length,
  closestStartDeltaMinutes:deltas.length?Math.round(Math.min(...deltas)):null,matchFailure};
}
function extract1x2(e){
 if(!e?.markets||typeof e.markets!=='object')return null;
 const found=[];
 for(const key of ['soccer.match_odds','soccer.matchOdds']){
 const m=e.markets[key];if(!m||m.status==='SUSPENDED'||m.status==='CLOSED')continue;
 for(const [period,entry] of Object.entries(m.submarkets||{})){
  if(entry?.status==='SUSPENDED'||entry?.status==='CLOSED')continue;
  if(period!=='period=ft')continue;
  const selections=entry?.selections||[];if(!Array.isArray(selections))continue;
  const odds={};let bad=false;
  for(const s of selections){
   if(!['home','draw','away'].includes(s?.outcome)||s.params||s.side!=='BACK'||s.status!=='SELECTION_ENABLED'||!Number.isFinite(Number(s.price))||Number(s.price)<=1)continue;
   if(odds[s.outcome]){bad=true;break;}
   odds[s.outcome]=Number(s.price);
  }
  if(!bad&&['home','draw','away'].every(k=>odds[k]))found.push(odds);
 }
 }
 // Both documented aliases may be present; accept identical prices only.
 return found.length&&found.every(o=>['home','draw','away'].every(k=>o[k]===found[0][k]))?found[0]:null;
}
module.exports={normalize,coreName,sameTeam,leagueParts,providerQuery,competitionMatch,matchingCompetition,eventKindOK,eventClock,eventTimeOK,sameEvent,matchingEvent,matchingDiagnostic,extract1x2};
