"use strict";
// Provider-grounded match and FULL TIME 1X2 matching. Never manufacture odds or cross-map teams.
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/ł/g,'l').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const CLUB_WORDS=new Set(['fc','afc','sc','cf','sv','vfb','fk','fkf','football','club']);
const coreName=v=>normalize(v).split(' ').filter(x=>!CLUB_WORDS.has(x)).join(' ');
function sameTeam(a,b){const n1=normalize(a),n2=normalize(b);if(!n1||!n2)return false;return n1===n2||(coreName(a).length>=4&&coreName(a)===coreName(b));}
function leagueParts(s){const parts=String(s||'').split(/\s*[.]\s*/).filter(Boolean);return parts.length>=2?{country:normalize(parts[0]),league:normalize(parts.slice(1).join(' '))}:null;}
function matchingCompetition(data,league){const expected=leagueParts(league);if(!expected)return null;const found=[];for(const category of data?.categories||[]){if(normalize(category.name)!==expected.country)continue;for(const c of category.competitions||[]){if(normalize(c.name)===expected.league&&typeof c.key==='string'&&/^[a-z0-9-]+$/.test(c.key))found.push(c);}}return found.length===1?found[0]:null;}
function eventKindOK(e,kind){return e?.status===(kind==='live'?'TRADING_LIVE':'TRADING')}
function eventTimeOK(e,start,kind,now=Date.now()){
 const a=Date.parse(start),b=Date.parse(e?.startTime);if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>15*60*1000)return false;
 if(kind==='live'&&(b>now+3*60000||b<now-24*3600000))return false;
 if(kind==='prematch'&&b<=now+60000)return false;
 return true;
}
function sameEvent(e,q,now=Date.now()){
 if(!e||!['live','prematch'].includes(q.kind||'prematch')||!eventKindOK(e,q.kind||'prematch')||!eventTimeOK(e,q.start,q.kind||'prematch',now))return false;
 return sameTeam(e.home?.name,q.home)&&sameTeam(e.away?.name,q.away);
}
function matchingEvent(data,query,now=Date.now()){const found=(data?.events||[]).filter(e=>sameEvent(e,query,now));return found.length===1?found[0]:null;}
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
module.exports={normalize,coreName,sameTeam,leagueParts,matchingCompetition,eventKindOK,eventTimeOK,sameEvent,matchingEvent,extract1x2};
