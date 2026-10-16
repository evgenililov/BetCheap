'use strict';
// Universal EVENT routing for any sport exposed by the official 1xBet Marketing API.
// The client can supply only the event ID; the target comes ONLY from an authenticated API response.
const {geoDecision}=require('./geo-policy');
const APPROVED_TRACKER='reffpa.com';
function approvedBase(input){
 if(typeof input!=='string'||input.length>2048)return null;
 let u;try{u=new URL(input)}catch{return null;}
 if(u.protocol!=='https:'||u.hostname!==APPROVED_TRACKER||u.port||u.username||u.password||u.hash||u.pathname!=='/L')return null;
 if(!['tag','site','ad'].every(k=>u.searchParams.has(k))||u.searchParams.has('r'))return null;
 if(!/^d_[A-Za-z0-9_-]+$/.test(u.searchParams.get('tag')||''))return null;
 if(!/^\d+$/.test(u.searchParams.get('site')||'')||!/^\d+$/.test(u.searchParams.get('ad')||''))return null;
 return u;
}
function verifiedTarget(link){
 if(typeof link!=='string'||link.length>3000)return null;
 // Reject dot-segment traversal BEFORE URL() silently normalizes it away.
 if(/(?:^|\/)(?:\.|%2e){1,2}(?:\/|$)/i.test(link))return null;
 let u;try{u=new URL(link)}catch{return null;}
 if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash||u.search)return null;
 // Never redirect users directly to provider host. Only extract the operator-provided relative path.
 // Restrict to the documented event URL structure, regardless of sport name.
 const path=u.pathname;
 if(!/^\/en\/(?:line|live)\/[A-Za-z0-9%_\-/]+$/.test(path)||path.includes('..')||path.includes('//'))return null;
 // The provider hostname is independently configurable because official delivery hosts change.
 return path;
}
function routeEnabled(env,eventContext){
 return env.BETCHEAP_1XBET_DYNAMIC_ROUTES_APPROVED==='true' &&
        env.BETCHEAP_1XBET_TRACKING_LIVE_VERIFIED==='true' &&
        env.BETCHEAP_1XBET_GEO_RUNTIME_VERIFIED==='true' &&
        env.BETCHEAP_1XBET_ROUTES_APPROVED==='true' &&
        geoDecision(eventContext,env).allowed;
}
function buildVerifiedDynamicRoute({query,env,eventContext,providerEvent}){
 if(!routeEnabled(env,eventContext))return {kind:'none',verified:false};
 const eventId=String(query?.eventId||'');
 if(!/^\d{1,18}$/.test(eventId)||!providerEvent||String(providerEvent.sportEventId)!==eventId)return {kind:'none',verified:false};
 const kind=query?.kind==='live'?'live':'prematch';
 if(providerEvent.kind!==kind)return {kind:'none',verified:false};
 const base=approvedBase(env.ONEXBET_PARTNER_LINK);
 const path=verifiedTarget(providerEvent.link);
 if(!base||!path)return {kind:'none',verified:false};
 // Reject inconsistent sections: live events must link to live and pre-match events to line.
 if(kind==='live'&&!path.startsWith('/en/live/'))return {kind:'none',verified:false};
 if(kind==='prematch'&&!path.startsWith('/en/line/'))return {kind:'none',verified:false};
 const hostList=String(env.BETCHEAP_1XBET_APPROVED_EVENT_HOSTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 let sourceURL;try{sourceURL=new URL(providerEvent.link)}catch{return {kind:'none',verified:false}};
 if(!hostList.includes(sourceURL.hostname.toLowerCase()))return {kind:'none',verified:false};
 base.searchParams.set('r',path.slice(1));
 // This is an event-page redirect, NEVER claim market/selection prefill.
 return {kind:'event',verified:true,url:base.toString()};
}
module.exports={approvedBase,verifiedTarget,routeEnabled,buildVerifiedDynamicRoute};
