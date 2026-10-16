"use strict";
/* Betsson ISA integration. Never send OCB to a browser. Gateway must egress through Betsson-whitelisted static IP. */
const {summarizeEvent}=require('../lib/betsson-feed-summary');
const HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const reply=(statusCode,body)=>({statusCode,headers:HEADERS,body:JSON.stringify(body)});
const required=(name)=>String(process.env[name]||"").trim();

function readiness(){
 const prerequisites={trackingLink:true,ocbConfigured:!!required('BETSSON_OCB'),segmentIdConfigured:/^\d+$/.test(required('BETSSON_SEGMENT_ID')),gatewayConfigured:false,gatewayTokenConfigured:!!required('BETSSON_GATEWAY_TOKEN'),egressWhitelisted:required('BETSSON_EGRESS_WHITELISTED')==='true',feedAuthorized:required('BETSSON_FEED_APPROVED')==='true'};
 try {const u=new URL(required('BETSSON_GATEWAY_URL'));prerequisites.gatewayConfigured=u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&u.port===''&&u.hostname.includes('.')&&!(/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i.test(u.hostname));}catch{}
 return {operator:'Betsson',affiliateLinkReceived:true,trackingDomain:'record.betsson.com',trackingLinkNotActivated:false,affiliateRouteAvailable:true,feedStatus:Object.values(prerequisites).every(Boolean)?'configured-not-verified':'awaiting-ip-whitelist-and-ocb',prerequisites,oddsVerified:false,affiliateRoutingVerified:false,comparisonActive:false,notes:'Tracking link is not proof of odds feed or licensed GEO availability. No Betsson odds are displayed without live verified ISA feed.'};
}
exports.handler=async (event)=>{
 if(event.httpMethod!=='GET')return reply(405,{error:'Method not allowed'});
 const op=event.queryStringParameters?.op||'status';
 const status=readiness();
 if(op==='status')return reply(200,status);
 if(op!=='events')return reply(400,{error:'Unsupported operation'});
 if(status.feedStatus!=='configured-not-verified')return reply(503,{error:'Betsson feed not yet approved/configured; no Betsson odds available.',code:'BETSSON_FEED_PENDING',prerequisites:status.prerequisites});
 // Do not relay unrestricted user-supplied URLs or parameters to a private gateway.
 const mode=event.queryStringParameters?.mode||'prematch';
 if(!['prematch','live'].includes(mode))return reply(400,{error:'Invalid mode'});
 const fixtureTag=event.queryStringParameters?.fixtureTag;
 if(fixtureTag!==undefined&&!/^f-[A-Za-z0-9_-]{1,150}$/.test(fixtureTag))return reply(400,{error:'Invalid fixture tag'});
 const page=Number(event.queryStringParameters?.page||1);
 if(!Number.isInteger(page)||page<1||page>20)return reply(400,{error:'Invalid page'});
 const gateway=new URL(required('BETSSON_GATEWAY_URL'));
 gateway.pathname='/isa/v2/'+encodeURIComponent(required('BETSSON_SEGMENT_ID'))+'/en/event';
 gateway.searchParams.set('ocb',required('BETSSON_OCB'));
 gateway.searchParams.set('eventPhase',mode==='live'?'2':'1');
 gateway.searchParams.set('eventCount','50');gateway.searchParams.set('page',String(page));
 gateway.searchParams.set('eventSortBy','2');gateway.searchParams.set('categoryIds','1');
 if(fixtureTag)gateway.searchParams.set('fixtureTags',fixtureTag);
 try{
  const res=await fetch(gateway,{headers:{Authorization:'Bearer '+required('BETSSON_GATEWAY_TOKEN'),Accept:'application/json'},signal:AbortSignal.timeout(9000),redirect:'error'});
  if(!res.ok)return reply(502,{error:'Betsson feed not available',code:res.status===401||res.status===403?'BETSSON_ACCESS_REJECTED':res.status===429?'BETSSON_RATE_LIMITED':'BETSSON_UPSTREAM_ERROR',upstreamStatus:res.status});
  const raw=await res.json();
  if(!raw||!Array.isArray(raw.el))return reply(502,{error:'Unexpected Betsson feed schema',code:'BETSSON_SCHEMA_ERROR'});
  // Explicitly select documented metadata; never relay arbitrary upstream fields or assume status enums.
  return reply(200,{provider:'Betsson ISA',mode,receivedAt:new Date().toISOString(),eventCount:raw.el.length,page:Number.isInteger(raw.pn)?raw.pn:page,totalPages:Number.isInteger(raw.tp)?raw.tp:null,totalEvents:Number.isInteger(raw.tec)?raw.tec:null,events:raw.el.map(summarizeEvent),diagnosticOnly:true,marketsVerified:false,comparisonActive:false});
 }catch{return reply(502,{error:'Betsson feed unavailable; no synthetic fallback',code:'BETSSON_FETCH_FAILED'});}
};
exports._test={readiness};
