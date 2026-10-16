const {geoDecision}=require("./geo-policy");
/* Affiliate routing is deliberately fail-closed. Links must be generated in the official 1xBet affiliate dashboard using Target page. */
const HOST='reffpa.com';
function getRoute(query, env=process.env, event=null){
 const eventId=String(query.eventId||'').trim(), type=String(query.type||'').trim();
 const param=String(query.parameter||''), section=String(query.section||'');
 if(!/^\d{1,18}$/.test(eventId)||!/^\d{1,5}$/.test(type)||param.length>60||section.length>100)return {kind:'none',verified:false};
 // Never issue live affiliate URLs until both operator approval and a validated jurisdiction gate are deployed.
 if(env.BETCHEAP_1XBET_ROUTES_APPROVED!=='true'||!geoDecision(event,env).allowed)return {kind:'none',verified:false};
 let routes;try{routes=JSON.parse(env.BETCHEAP_1XBET_ROUTES||'{}')}catch{return {kind:'none',verified:false}};
 if(!routes||typeof routes!=='object'||Array.isArray(routes))return {kind:'none',verified:false};
 const exactKey=eventId+'|'+type+'|'+param+'|'+section;
 const key=Object.hasOwn(routes,exactKey)?exactKey:eventId+'|event';
 const route=Object.hasOwn(routes,key)?routes[key]:null;
 if(!route||typeof route!=='object'||route.verified!==true||typeof route.url!=='string')return {kind:'none',verified:false};
 let u;try{u=new URL(route.url)}catch{return {kind:'none',verified:false}};
 if(u.protocol!=='https:'||u.hostname!==HOST||u.username||u.password||u.hash)return {kind:'none',verified:false};
 if(u.pathname!=='/L'||!u.searchParams.has('tag')||!u.searchParams.has('site')||!u.searchParams.has('ad'))return {kind:'none',verified:false};
 // An event route may never fall back to a generic landing page or the wrong match.
 // Store the exact, source-provided relative targetPath alongside its approved URL.
 const targetPath=route.targetPath;
 if(typeof targetPath!=='string'||!/^\/en\/(?:line|live)\/[A-Za-z0-9%\-_/]+$/.test(targetPath)||targetPath.includes('..'))return {kind:'none',verified:false};
 const actualTarget=u.searchParams.get('r');
 if(!actualTarget||actualTarget.replace(/^\//,'')!==targetPath.slice(1))return {kind:'none',verified:false};
 const tag=u.searchParams.get('tag')||'';
 if(!/^d_[A-Za-z0-9_\-]+$/.test(tag)||!/^[0-9]+$/.test(u.searchParams.get('site')||'')||!/^[0-9]+$/.test(u.searchParams.get('ad')||''))return {kind:'none',verified:false};
 const kind=key.endsWith('|event')?'event':'selection';
 return {kind,verified:true,url:u.toString()};
}
exports.getRoute=getRoute;
