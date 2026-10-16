(function (root) {
  'use strict';
  const MAX_AGE_MS = 15 * 60 * 1000;
  const CLOCK_TOLERANCE_MS = 60 * 1000;
  function timestamp(value, now) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const time = Date.parse(value);
    return Number.isFinite(time) && time <= now + CLOCK_TOLERANCE_MS ? time : null;
  }
  function inspect(data, now = Date.now()) {
    if (!data || !Array.isArray(data.events)) return {state:'invalid', message:'The response has no valid event list.'};
    if (data.events.some(event => !event || typeof event !== 'object' || !Array.isArray(event.bookmakers) || event.bookmakers.some(book => !book || typeof book !== 'object'))) return {state:'invalid', message:'The response contains invalid event records.'};
    if (data.mode === 'demo' || data.demo === true) return {state:'demo', message:'DEMONSTRATION DATA — not current market data.'};
    const fetched = timestamp(data.fetchedAt, now);
    const label = data.source?.name === 'The Odds API' ? 'The Odds API' : 'Source not identified';
    const updates = data.events.flatMap(event => (Array.isArray(event.bookmakers) ? event.bookmakers : []).map(book => timestamp(book.lastUpdate, now)));
    const validUpdates = updates.filter(time => time !== null);
    const unknown = updates.length - validUpdates.length;
    const oldest = validUpdates.length ? Math.min(...validUpdates) : null;
    let state = 'recent';
    if (fetched === null || unknown || !updates.length || label === 'Source not identified') state = 'unknown';
    if ((fetched !== null && now - fetched > MAX_AGE_MS) || (oldest !== null && now - oldest > MAX_AGE_MS)) state = 'stale';
    if (!data.events.length) state = 'empty';
    const utc = time => time === null ? 'unknown' : new Date(time).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
    return {
      state, source:label, fetchedAt:fetched, oldestUpdate:oldest, unknownUpdates:unknown,
      message:`Source: ${label}. Retrieved: ${utc(fetched)}. Oldest provider update: ${utc(oldest)}. ${unknown ? `${unknown} update timestamp(s) missing or invalid. ` : ''}${state === 'stale' ? 'Some data is over 15 minutes old.' : state === 'unknown' ? 'Freshness cannot be fully verified.' : state === 'empty' ? 'No events returned for this request.' : 'Timestamps are within 15 minutes; this does not guarantee current prices.'}`
    };
  }
  const api = {inspect, MAX_AGE_MS};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BetcheapDataStatus = api;
})(typeof window !== 'undefined' ? window : globalThis);
