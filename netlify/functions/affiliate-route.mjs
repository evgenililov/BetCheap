// Trusted Netlify geo + verified per-event Marketing API destination.
// All sports are supported; no hand-curated event IDs are required.
import routingCore from '../lib/affiliate-route-core.js';
import dynamicCore from '../lib/dynamic-event-routing.js';
import onexbet from './onexbet.js';
const {getRoute}=routingCore;
const {routeEnabled,buildVerifiedDynamicRoute}=dynamicCore;
export default async function handler(request,context){
 if(request.method!=='GET')return Response.json({error:'method_not_allowed'},{status:405,headers:{'Allow':'GET','Cache-Control':'no-store'}});
 const query=Object.fromEntries(new URL(request.url).searchParams);
 const geo=context?.geo?.country?.code;
 const trustedEvent={requestContext:{geo:{country:{code:geo}}}};
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
 // Retain legacy exact approved per-event route map.
 const explicit=getRoute(query,process.env,trustedEvent);
 if(explicit.verified)return Response.json(explicit,{headers});
 // NEVER call provider API or create a link for a visitor without pre-approved GEO.
 if(!routeEnabled(process.env,trustedEvent))return Response.json({kind:'none',verified:false},{headers});
 if(!/^\d{1,18}$/.test(String(query.eventId||'')))return Response.json({kind:'none',verified:false},{headers});
 const kind=query.kind==='live'?'live':'prematch';
 try{
   const providerEvent=await onexbet.fetchEventForRouting(query.eventId,kind);
   const result=buildVerifiedDynamicRoute({query:{...query,kind},env:process.env,eventContext:trustedEvent,providerEvent});
   return Response.json(result,{headers});
 }catch{
   return Response.json({kind:'none',verified:false},{headers});
 }
}
