'use strict';
// Configuration only: never contacts the provider, exposes keys, or consumes quota.
exports.handler = async event => {
  const headers = {'Content-Type':'application/json', 'Cache-Control':'no-store'};
  if (event.httpMethod !== 'GET') return {statusCode:405, headers:{...headers, Allow:'GET'}, body:JSON.stringify({error:'Method not allowed'})};
  const configured = Boolean(process.env.ODDS_API_KEY?.trim());
  return {statusCode:200, headers, body:JSON.stringify({
    configured, provider:'The Odds API', checkedAt:new Date().toISOString(),
    connectionTested:false,
    message:configured ? 'A provider key is configured. Its validity and remaining quota have not been tested.' : 'The provider key is not configured. Current data is unavailable.'
  })};
};
