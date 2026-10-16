(function(root){
'use strict';
// Product cutoff, not a guarantee of an executable price. Pre-match football only.
const MAX_AGE_MS=5*60*1000;
function fresh(value,now){const t=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(t)&&t<=now+60000&&now-t<=MAX_AGE_MS;}
function inspect(event,selection,meta,now=Date.now()){
  const fail=message=>({rows:[],excluded:0,message});
  if(meta?.mode!=='provider'||meta?.schemaVersion!==2||meta?.source?.name!=='The Odds API'||!fresh(meta.fetchedAt,now))return fail('Refresh the search: provider data is missing, outdated or incompatible.');
  if(!event?.id||!Array.isArray(meta.events)||!meta.events.some(e=>e.id===event.id))return fail('Event does not belong to this response.');
  if(!Number.isFinite(Date.parse(event.start))||Date.parse(event.start)<=now)return fail('Pre-match comparison only. This event has started or its start time is unknown.');
  if(![event.home,event.away,'Draw'].includes(selection))return fail('Select an exact match outcome.');
  const rows=[],seen=new Set(); let excluded=0;
  for(const b of event.bookmakers||[]){
    const outcomes=Array.isArray(b.outcomes)?b.outcomes:[];
    const names=[event.home,event.away,'Draw'];
    const exchange=/betfair_ex|matchbook|betdaq|smarkets|exchange/i.test(String(b.key)+' '+String(b.name));
    const valid=typeof b.key==='string'&&b.key&&b.market==='h2h'&&fresh(b.lastUpdate,now)&&!exchange&&outcomes.length===3&&names.every(n=>outcomes.filter(o=>o?.name===n&&typeof o.price==='number'&&Number.isFinite(o.price)&&o.price>1&&o.point==null).length===1);
    if(!valid||seen.has(b.key)){excluded++;continue;}
    seen.add(b.key);const o=outcomes.find(o=>o.name===selection);
    rows.push({key:b.key,book:b.name,name:o.name,price:o.price,lastUpdate:b.lastUpdate});
  }
  rows.sort((a,b)=>b.price-a.price||a.key.localeCompare(b.key));
  return {rows,excluded,message:rows.length<2?'At least two comparable bookmakers with recent prices are required.':`Compared ${rows.length} bookmakers; excluded ${excluded}. Pre-match 1X2 only. Prices updated within 5 minutes; availability and stake limits are not verified. Returns are before taxes or fees.`};
}
function partnerLink(config,key,country,region){
  const p=config.affiliatePrograms?.[key];
  if(!config.enablePartnerLinks||!p||p.status!=='active')return null;
  const rule=p.markets?.[country];
  // Technical gate only; country self-selection is not geolocation or legal verification.
  if(!rule?.approved||!rule?.reviewedAt||!rule?.disclosure||!rule?.termsUrl||!Array.isArray(rule.channels)||!rule.channels.includes('website')||!p.regions?.includes(region))return null;
  const href=rule.url||config.affiliateLinks?.[key];
  try{const u=new URL(href),t=new URL(rule.termsUrl);if(u.protocol!=='https:'||u.username||u.password||t.protocol!=='https:'||!p.allowedHosts?.includes(u.hostname))return null;}catch{return null;}
  return {url:href,disclosure:rule.disclosure,termsUrl:rule.termsUrl};
}
const api={inspect,partnerLink,MAX_AGE_MS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BetcheapComparison=api;
})(typeof window!=='undefined'?window:globalThis);
