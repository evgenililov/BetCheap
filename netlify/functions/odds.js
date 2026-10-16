const BASE = 'https://api.the-odds-api.com/v4';
const allowedSports = new Set([
  'soccer_epl','soccer_spain_la_liga','soccer_uefa_champs_league',
  'soccer_italy_serie_a','soccer_germany_bundesliga','soccer_france_ligue_one'
]);
const allowedRegions = new Set(['eu','uk','us']);
const cache = new Map();

exports.handler = async (event) => {
  const headers = {'Content-Type':'application/json','Cache-Control':'no-store'};
  if (event.httpMethod !== 'GET') return {statusCode:405,headers,body:JSON.stringify({error:'Method not allowed'})};
  const apiKey = process.env.ODDS_API_KEY?.trim();
  if (!apiKey) return {statusCode:503,headers:{...headers,'Cache-Control':'no-store'},body:JSON.stringify({error:'Current data is not configured yet.',code:'NOT_CONFIGURED'})};
  const sport = event.queryStringParameters?.sport || 'soccer_epl';
  const region = event.queryStringParameters?.region || 'eu';
  if (!allowedSports.has(sport) || !allowedRegions.has(region)) return {statusCode:400,headers,body:JSON.stringify({error:'Unsupported sport or region'})};
  const key = `${sport}:${region}`;
  const hit = cache.get(key);
  if (hit && Date.now()-hit.time < 300000) return {statusCode:200,headers:{...headers,'X-Betcheap-Cache':'HIT'},body:JSON.stringify(hit.data)};
  try {
    const url = new URL(`${BASE}/sports/${encodeURIComponent(sport)}/odds/`);
    url.searchParams.set('apiKey', apiKey);
    url.searchParams.set('regions', region);
    url.searchParams.set('markets','h2h');
    url.searchParams.set('oddsFormat','decimal');
    url.searchParams.set('dateFormat','iso');
    const r = await fetch(url, {signal:AbortSignal.timeout(12000)});
    const body = await r.json();
    if (!r.ok) return {statusCode:r.status===429?429:502,headers:{...headers,'Cache-Control':'no-store'},body:JSON.stringify({error:r.status===429?'Provider request limit reached. Try again later.':'The provider request failed. Check the provider account configuration.',code:r.status===429?'RATE_LIMITED':'PROVIDER_ERROR'})};
    if (!Array.isArray(body)) throw new Error('Invalid provider response');
    const data = {
      schemaVersion:2, mode:'provider', source:{name:'The Odds API'},
      events: body.map(ev=>({
        id:ev.id,sport:ev.sport_title,start:ev.commence_time,home:ev.home_team,away:ev.away_team,
        bookmakers:(ev.bookmakers||[]).map(b=>({key:b.key,name:b.title,market:'h2h',lastUpdate:(b.markets||[]).find(m=>m.key==='h2h')?.last_update||null,
          outcomes:(b.markets||[]).find(m=>m.key==='h2h')?.outcomes||[]
        })).filter(b=>b.outcomes.length)
      })),
      quota:{remaining:r.headers.get('x-requests-remaining'),used:r.headers.get('x-requests-used'),last:r.headers.get('x-requests-last')},
      fetchedAt:new Date().toISOString(),region,sport
    };
    cache.set(key,{time:Date.now(),data});
    return {statusCode:200,headers:{...headers,'X-Betcheap-Cache':'MISS'},body:JSON.stringify(data)};
  } catch(e) {
    return {statusCode:502,headers:{...headers,'Cache-Control':'no-store'},body:JSON.stringify({error:'Unable to load provider data. Please try again later.',code:'FETCH_FAILED'})};
  }
};
