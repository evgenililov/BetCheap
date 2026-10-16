"use strict";
exports.handler = async (event) => {
 const headers={"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
 if(event.httpMethod!=="GET")return {statusCode:405,headers,body:JSON.stringify({error:"Method not allowed"})};
 const flag = name => typeof process.env[name]==="string" && process.env[name].trim().length>0;
 return {statusCode:200,headers,body:JSON.stringify({
  comparison:{provider:"The Odds API",configured:flag("ODDS_API_KEY"),endpoint:"/.netlify/functions/odds",market:"pre-match football full-time 1X2",note:"Configuration only. Not evidence of live pricing or a particular bookmaker."},
  onexbet:{provider:"1xBet Marketing API",configured:flag("ONEXBET_CLIENT_ID")&&flag("ONEXBET_CLIENT_SECRET")&&flag("ONEXBET_REF"),endpoint:"/.netlify/functions/onexbet",note:"Independent event IDs. Not automatically merged with comparison feed."},
  betsson:{provider:"Betsson ISA REST",trackingLinkReceived:true,apiRequiresStaticWhitelistedIP:true,ocbConfigured:flag("BETSSON_OCB"),segmentIdConfigured:flag("BETSSON_SEGMENT_ID"),gatewayConfigured:flag("BETSSON_GATEWAY_URL"),endpoint:"/.netlify/functions/betsson?op=status",oddsVerified:false,comparisonActive:false},
  mode:"configuration-only",affiliateLinksValidated:false
 })};
};
