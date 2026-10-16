'use strict';
const {geoDecision}=require('../lib/geo-policy');

const BASE = 'https://cpservm.com/gateway/marketing';
const TOKEN_URL = 'https://cpservm.com/gateway/token';
let tokenCache = { value: '', until: 0 };
async function getToken(){
  const clientId = clean(process.env.ONEXBET_CLIENT_ID);
  const clientSecret = clean(process.env.ONEXBET_CLIENT_SECRET);
  if (!clientId || !clientSecret) throw new Error('Missing API credentials');
  if (tokenCache.value && Date.now() < tokenCache.until) return tokenCache.value;
  const body = new URLSearchParams({client_id:clientId,client_secret:clientSecret});
  const response = await fetch(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:body.toString(),signal:AbortSignal.timeout(12000)});
  if (!response.ok) { const e=new Error('Token request failed'); e.status=response.status; throw e; }
  const result=await response.json();
  if (!result || typeof result.access_token!=='string' || !result.access_token) throw new Error('Invalid token response');
  const lifetime=Number(result.expires_in);
  tokenCache={value:result.access_token,until:Date.now()+Math.max(0,(Number.isFinite(lifetime)?lifetime:60)-60)*1000};
  return result.access_token;
}

const detailCache = new Map();
const couponThrottle = new Map();
const diagnosticsCache = new Map();
const PREMATCH_TTL_MS = 20_000;
const LIVE_TTL_MS = 5_000;

const json = (statusCode, body, extra={}) => ({
  statusCode,
  headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extra},
  body:JSON.stringify(body)
});
const int = v => /^\d+$/.test(String(v||'')) ? Number(v) : null;
const finite = v => { const n=Number(v); return Number.isFinite(n) ? n : null; };
const clean = v => typeof v === 'string' ? v.trim() : '';
const safeLng = v => /^[a-z]{2}$/i.test(clean(v)) ? clean(v).toLowerCase() : 'en';
const safePartnerLink = value => {
  const v=clean(value); if(!v) return null;
  try { const u=new URL(v.startsWith('http')?v:`https://${v}`); if(u.protocol!=='https:'||u.hostname!=='reffpa.com'||u.pathname!=='/L'||u.username||u.password||u.hash||!u.searchParams.has('tag')||!u.searchParams.has('site')||!u.searchParams.has('ad'))return null; return u.host+u.pathname+u.search; } catch { return null; }
};
// Restrict provider-generated coupon destinations to operator-approved HTTPS hosts.
// Exact hostnames only: never accept subdomain suffixes or arbitrary redirects.
function approvedCouponUrl(value, env=process.env){
  if(typeof value!=='string'||value.length>4096)return null;
  const allowed=String(env.BETCHEAP_1XBET_APPROVED_COUPON_HOSTS||'').split(',')
    .map(v=>v.trim().toLowerCase()).filter(v=>/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v));
  if(!allowed.length)return null;
  let u;try{u=new URL(value);}catch{return null;}
  if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port||!allowed.includes(u.hostname.toLowerCase()))return null;
  return u.toString();
}
exports.approvedCouponUrl=approvedCouponUrl;
function config(){
  const credentialsPresent=Boolean(clean(process.env.ONEXBET_CLIENT_ID)&&clean(process.env.ONEXBET_CLIENT_SECRET));
  const ref=int(process.env.ONEXBET_REF);
  const gr=int(process.env.ONEXBET_GR) ?? 0;
  const cnt=int(process.env.ONEXBET_CNT) ?? 0;
  const partnerLink=safePartnerLink(process.env.ONEXBET_PARTNER_LINK);
  return {ref,gr,cnt,partnerLink,configured:Boolean(credentialsPresent&&ref)};
}
async function upstream(path, params, token){
  const url=new URL(BASE+path);
  for(const [k,v] of Object.entries(params||{})) if(v!==null&&v!==undefined&&v!=='') url.searchParams.set(k,String(v));
  const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  let body; try{body=await r.json()}catch{body=null}
  if(!r.ok){ const e=new Error('Marketing API request failed'); e.status=r.status; throw e; }
  return body;
}
function normalizeEvent(d,kind){
  if(!d||typeof d!=='object') return null;
  const odds=(Array.isArray(d.oddsLocalization)?d.oddsLocalization:[]).filter(o=>o&&o.isBlocked!==true&&Number.isFinite(Number(o.oddsMarket))).map(o=>({
    type:o.type, parameter:o.parameter??null, oddsMarket:Number(o.oddsMarket), playerId:o.playerId??null,
    display:o.display??null, name:o.nameLocalization??o.oddsNameLocalization??null, isBlocked:Boolean(o.isBlocked)
  }));
  return {
    provider:'1xBet Marketing API', kind, sportEventId:d.sportEventId??null,
    constSportEventId:d.constSportEventId??null, mainConstSportEventId:d.mainConstSportEventId??null,
    tournamentId:d.tournamentId??null, sportId:d.sportId??null,
    tournament:d.tournamentNameLocalization??null, home:d.opponent1NameLocalization??null,
    away:d.opponent2NameLocalization??null, start:d.startDate??null, link:d.link??null,
    period:d.period??null, periodName:d.periodName??null, type:d.type??null, odds, subGames:Array.isArray(d.subGames)?d.subGames.map(x=>normalizeEvent(x,kind)).filter(Boolean):[]
  };
}
// Read-through upstream lookup for per-event affiliate routing. Cached across concurrent requests.
// Caller must do geo/compliance gating BEFORE accessing this method.
const routingLookupPending=new Map();
async function fetchEventForRouting(sportEventId,kind='prematch'){
  const id=int(sportEventId);
  if(!id||!['prematch','live'].includes(kind))return null;
  const key=`${kind}:${id}:en`, ttl=kind==='live'?LIVE_TTL_MS:PREMATCH_TTL_MS;
  const hit=detailCache.get(key);
  if(hit&&Date.now()-hit.time<ttl)return hit.data?.event||null;
  if(routingLookupPending.has(key))return routingLookupPending.get(key);
  const promise=(async()=>{
    const c=config();if(!c.configured)return null;
    const data=await upstream(`/datafeed/loadtree/${kind}/api/v1/sporteventDetail`,
      {ref:c.ref,gr:c.gr,cnt:c.cnt,lng:'en',sportEventId:id,withSubGames:'false',schemeOfGettingOdds:'GetAllOdds'},await getToken());
    const normalized=normalizeEvent(data,kind);
    if(!normalized||String(normalized.sportEventId)!==String(id))return null;
    detailCache.set(key,{time:Date.now(),data:{event:normalized}});
    return normalized;
  })();
  routingLookupPending.set(key,promise);
  try{return await promise;}finally{routingLookupPending.delete(key)}
}
exports.fetchEventForRouting=fetchEventForRouting;
exports.handler = async event => {
  if(event.httpMethod!=='GET') return json(405,{error:'Method not allowed'},{Allow:'GET'});
  const c=config(), q=event.queryStringParameters||{}, op=q.op||'status';
  if(op==='status') return json(200,{configured:c.configured,provider:'1xBet Marketing API',refConfigured:Boolean(c.ref),geoConfigured:Boolean(c.gr||c.cnt),partnerLinkConfigured:Boolean(c.partnerLink),connectionTested:false});
  if(!c.configured) return json(503,{error:'1xBet Marketing API is not configured.',code:'NOT_CONFIGURED'});
  try{
    if(op==='oauth-test' || op==='catalog-test'){
      // Public diagnostic results are cached to avoid repeated upstream requests.
      const cached=diagnosticsCache.get(op);
      if(cached && Date.now()-cached.time<60000) return json(cached.status,cached.body,{'X-Betcheap-Cache':'HIT'});
      const token=await getToken();
      let result={ok:true,stage:'oauth',provider:'1xBet Marketing API',authenticated:true};
      if(op==='catalog-test'){
        const catalog=await upstream('/datafeed/loadtree/prematch/api/v1/sportList',{
          ref:c.ref
        },token);
        result={ok:true,stage:'catalog',provider:'1xBet Marketing API',authenticated:true,
          dataReceived:catalog!==null && catalog!==undefined,
          topLevelType:Array.isArray(catalog)?'array':typeof catalog,
          itemCount:Array.isArray(catalog)?catalog.length:(Array.isArray(catalog?.items)?catalog.items.length:null),
          reportedCount:Number.isInteger(catalog?.count)?catalog.count:null};
      }
      diagnosticsCache.set(op,{time:Date.now(),status:200,body:result});
      return json(200,result,{'X-Betcheap-Cache':'MISS'});
    }
    if(['sports','tournaments','events'].includes(op)){
      const kind=q.kind==='live'?'live':'prematch';
      const sportId=int(q.sportId), tournamentId=int(q.tournamentId);
      if(op==='tournaments'&&!sportId) return json(400,{error:'Valid sportId required'});
      if(op==='events'&&!tournamentId) return json(400,{error:'Valid tournamentId required'});
      const path=op==='sports'?'sportList':op==='tournaments'?'tournaments':'sporteventIds';
      const params={ref:c.ref};
      // Marketing API docs: omitting count returns ALL available tournaments.
      if(op==='tournaments') {params.sportId=sportId;params.lng=safeLng(q.lng);}
      if(op==='events') {params.tournamentId=tournamentId;params.count=30;}
      const cacheKey=`${kind}:${op}:${sportId||0}:${tournamentId||0}:${safeLng(q.lng)}`;
      const ttl=kind==='live'?5000:30000;
      const hit=diagnosticsCache.get(cacheKey);
      if(hit&&Date.now()-hit.time<ttl)return json(200,hit.body,{'X-Betcheap-Cache':'HIT'});
      const token=await getToken();
      const data=await upstream(`/datafeed/loadtree/${kind}/api/v1/${path}`,params,token);
      const items=Array.isArray(data?.items)?data.items:Array.isArray(data)?data:(data?.items&&typeof data.items==='object'?[data.items]:[]);
      const reportedCount=Number.isInteger(data?.count)?data.count:null;
      // A provider-side smaller response may indicate filtering, not necessarily truncation.
      const possiblyTruncated=reportedCount!==null && reportedCount>items.length || (op==='events' && items.length>=30);
      const result={ok:true,kind,operation:op,fetchedAt:new Date().toISOString(),count:items.length,reportedCount,requestedCount:null,possiblyTruncated,items};
      diagnosticsCache.set(cacheKey,{time:Date.now(),body:result});
      return json(200,result,{'X-Betcheap-Cache':'MISS'});
    }
    if(op==='detail'){
      const sportEventId=int(q.sportEventId), kind=q.kind==='live'?'live':'prematch';
      if(!sportEventId) return json(400,{error:'sportEventId is required.'});
      const ttl=kind==='live'?LIVE_TTL_MS:PREMATCH_TTL_MS, key=`${kind}:${sportEventId}:${safeLng(q.lng)}`;
      const hit=detailCache.get(key);
      if(hit&&Date.now()-hit.time<ttl) return json(200,hit.data,{'X-Betcheap-Cache':'HIT'});
      const data=await upstream(`/datafeed/loadtree/${kind}/api/v1/sporteventDetail`,{
        ref:c.ref,gr:c.gr,cnt:c.cnt,lng:safeLng(q.lng),sportEventId,withSubGames:'true',schemeOfGettingOdds:'GetAllOdds'
      },await getToken());
      const out={schemaVersion:1,mode:'provider',source:{name:'1xBet Marketing API'},fetchedAt:new Date().toISOString(),event:normalizeEvent(data,kind)};
      detailCache.set(key,{time:Date.now(),data:out}); return json(200,out,{'X-Betcheap-Cache':'MISS'});
    }
    if(op==='sharecoupon'){
      if(process.env.ONEXBET_ENABLE_COUPONS!=='true'||process.env.BETCHEAP_1XBET_GEO_RUNTIME_VERIFIED!=='true'||process.env.BETCHEAP_1XBET_DISTRIBUTED_RATE_LIMIT_READY!=='true'||!geoDecision(event).allowed||!c.partnerLink||process.env.BETCHEAP_1XBET_COUPON_PARTNER_APPROVED!=='true') return json(403,{error:'Coupon deep links unavailable in this market.',code:'COUPONS_DISABLED'});
      // Best-effort per-instance throttling. Production must additionally use an edge/distributed rate limit.
      const cc=geoDecision(event).country;
      const now=Date.now(), gate=`${cc}:${String(event.headers?.['x-nf-request-id']||'shared')}`;
      if(couponThrottle.size>1000)couponThrottle.clear();
      const last=couponThrottle.get(gate)||0;
      if(now-last<5000)return json(429,{error:'Please wait before requesting another link.',code:'RATE_LIMITED'});
      couponThrottle.set(gate,now);
      const sportEventId=int(q.sportEventId), type=int(q.type), oddsMarket=finite(q.oddsMarket), playerId=q.playerId?int(q.playerId):null;
      const kind=q.kind==='live'?1:3;
      if(!sportEventId||!type||!oddsMarket||oddsMarket<=1) return json(400,{error:'sportEventId, type and valid oddsMarket are required.'});
      // A client must not be allowed to request arbitrary events or odds. Validate against a recent API result.
      const current=detailCache.get(`${q.kind==='live'?'live':'prematch'}:${sportEventId}:${safeLng(q.lng)}`);
      const freshness=q.kind==='live'?LIVE_TTL_MS:PREMATCH_TTL_MS;
      const candidates=(item)=>[...(item?.odds||[]),...(item?.subGames||[]).flatMap(candidates)];
      const found=current&&Date.now()-current.time<freshness&&candidates(current.data?.event).some(o=>Number(o.type)===type&&Number(o.oddsMarket)===oddsMarket&&String(o.parameter??'')===String(q.parameter??'')&&String(o.playerId??'')===String(q.playerId??''));
      if(!found) return json(409,{error:'Selection requires a freshly verified event quote.',code:'STALE_SELECTION'});
      const data=await upstream('/datafeed/directories/api/v1/sharecoupon',{
        ref:c.ref,gr:c.gr,cnt:c.cnt,lng:safeLng(q.lng),sportEventId,type,oddsMarket,parameter:clean(q.parameter)||null,playerId,kind,partnerLink:c.partnerLink
      },await getToken());
      const approvedUrl=approvedCouponUrl(data);
      if(!approvedUrl) return json(502,{error:'Coupon destination is not approved.',code:'UNAPPROVED_COUPON_DESTINATION'});
      return json(200,{url:approvedUrl,provider:'1xBet Marketing API',generatedAt:new Date().toISOString()});
    }
    return json(400,{error:'Unsupported operation.'});
  }catch(e){
    const status=e.status===429?429:502;
    const stage=e.message==='Token request failed'||e.message==='Invalid token response'?'oauth':'upstream';
    return json(status,{ok:false,error:e.status===429?'Marketing API rate limit reached.':'1xBet Marketing API request failed.',code:e.status===429?'RATE_LIMITED':'PROVIDER_ERROR',stage,upstreamStatus:[400,401,403,404,429].includes(e.status)?e.status:null});
  }
};
