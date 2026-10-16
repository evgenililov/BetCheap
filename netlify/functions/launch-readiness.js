'use strict';
// This is a REDACTED configuration health report, not proof of operator tracking.
// Never expose affiliate URLs, country allowlists or credentials.
const {geoDecision}=require('../lib/geo-policy');
function evaluate(env=process.env){
 const yes=k=>env[k]==='true';
 const credentials=Boolean(env.ONEXBET_CLIENT_ID&&env.ONEXBET_CLIENT_SECRET&&/^\d+$/.test(String(env.ONEXBET_REF||'')));
 const approvedCountries=String(env.BETCHEAP_1XBET_APPROVED_COUNTRIES||'').split(',').map(s=>s.trim().toUpperCase()).filter(s=>/^[A-Z]{2}$/.test(s)&&s!=='BG');
 const geoConfigured=yes('BETCHEAP_1XBET_GEO_GATE_READY')&&yes('BETCHEAP_1XBET_COUNTRIES_LEGALLY_REVIEWED')&&approvedCountries.length>0;
 const geoRuntimeVerified=yes('BETCHEAP_1XBET_GEO_RUNTIME_VERIFIED');
 const rateLimitReady=yes('BETCHEAP_1XBET_DISTRIBUTED_RATE_LIMIT_READY');
 let routeRecords=0,validRouteRecords=0;
 try{
  const routes=JSON.parse(env.BETCHEAP_1XBET_ROUTES||'{}');
  if(routes&&typeof routes==='object'&&!Array.isArray(routes)){
   routeRecords=Object.keys(routes).length;
   for(const [key,v] of Object.entries(routes)){
    if(!/^\d{1,18}\|(event|\d{1,5}\|[^|]{0,60}\|[^|]{1,100})$/.test(key)||!v||v.verified!==true||typeof v.url!=='string'||typeof v.targetPath!=='string'||!/^\/en\/(?:line|live)\/[A-Za-z0-9%\-_/]+$/.test(v.targetPath)||v.targetPath.includes('..'))continue;
    try{const u=new URL(v.url);if(u.protocol==='https:'&&u.hostname==='reffpa.com'&&u.pathname==='/L'&&!u.username&&!u.password&&!u.hash&&['tag','site','ad'].every(p=>u.searchParams.has(p))&&u.searchParams.get('r')?.replace(/^\//,'')===v.targetPath.slice(1))validRouteRecords++}catch{}
   }
  }
 }catch{}
 const routesConfigured=yes('BETCHEAP_1XBET_ROUTES_APPROVED')&&validRouteRecords>0;
 const dynamicRoutesConfigured=yes('BETCHEAP_1XBET_DYNAMIC_ROUTES_APPROVED')&&yes('BETCHEAP_1XBET_TRACKING_LIVE_VERIFIED')&&Boolean(env.ONEXBET_PARTNER_LINK)&&Boolean(env.BETCHEAP_1XBET_APPROVED_EVENT_HOSTS)&&credentials;
 // Actual eligibility additionally depends on trusted geo.country.code in each incoming request.
 const requestEligibleInApprovedGeo=geoConfigured&&geoRuntimeVerified&&yes('BETCHEAP_1XBET_ROUTES_APPROVED')&&(routesConfigured||dynamicRoutesConfigured);
 const couponConfigured=geoConfigured&&geoRuntimeVerified&&rateLimitReady&&yes('ONEXBET_ENABLE_COUPONS')&&yes('BETCHEAP_1XBET_COUPON_PARTNER_APPROVED')&&Boolean(env.ONEXBET_PARTNER_LINK);
 return {
  apiCredentialsConfigured:credentials,
  geoReviewConfigured:geoConfigured,
  geoRuntimeVerified,
  operationalSafetyConfigured:geoRuntimeVerified&&rateLimitReady,
  eventRoutesConfigured:routesConfigured,
  dynamicEventRoutesConfigured:dynamicRoutesConfigured,
  verifiedRouteRecords:validRouteRecords,
  couponConfigured,
  requestEligibleInApprovedGeo,
  // These two cannot be inferred from env variables or local tests.
  affiliateTrackingLiveTestCompleted:false,
  selectionPrefillLiveTestCompleted:false,
  siteIsLive:Boolean(credentials),
  readyForPublicAffiliateRouting:false,
  message:'Configuration checks only. Affiliate conversion reporting and selection prefill require partner-dashboard and legal-GEO end-to-end tests.'
 };
}
exports.evaluate=evaluate;
exports.handler=async()=>({statusCode:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(evaluate())});
