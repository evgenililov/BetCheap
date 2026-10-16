"use strict";
// Only server-provided request context can certify geography; never trust user query, forwarded IP, or arbitrary headers.
// This adapter is intentionally fail-closed if the deployed runtime provides no trusted geo context.
const CODE = /^[A-Z]{2}$/;
function countryFromContext(event) {
  const raw=event?.requestContext?.geo?.country?.code;
  return typeof raw==='string'&&CODE.test(raw.toUpperCase())?raw.toUpperCase():null;
}
function geoDecision(event,env=process.env){
  const country=countryFromContext(event);
  const permitted=new Set(String(env.BETCHEAP_1XBET_APPROVED_COUNTRIES||'').split(',').map(s=>s.trim().toUpperCase()).filter(s=>CODE.test(s)&&s!=='BG'));
  const configured=env.BETCHEAP_1XBET_GEO_GATE_READY==='true'&&env.BETCHEAP_1XBET_COUNTRIES_LEGALLY_REVIEWED==='true';
  return {allowed:Boolean(configured&&country&&country!=='BG'&&permitted.has(country)),country};
}
module.exports={countryFromContext,geoDecision};
