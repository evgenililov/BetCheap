# BetCheap v2.39 — Cloudbet diagnostics and cache (NO DEPLOY)

This is a combined work-in-progress package based on v2.37 plus Cloudbet comparison improvements. Do NOT deploy just for this patch.

## Fixes
- Official documented Cloudbet query market selector: soccer.matchOdds; response accepts soccer.match_odds or soccer.matchOdds.
- API HTTP 400/401/403/429 and timeout errors are classified and show sanitized upstream stage (catalog/competition) and status without revealing secrets.
- 2-minute in-memory serverless catalog cache, best-effort per warm instance; fewer unnecessary requests.
- Unexpected upstream catalog/competition response shapes are rejected (no fake comparison).
- Preserves strict same-event match and full-time 1X2 validation, LIVE vs pre-match and GEO/affiliate protections.

## Limits
- Production has NOT been updated.
- Cloudbet credentials are only in Netlify and cannot be verified locally. Actual Cloudbet API result and cross-bookmaker comparison are NOT confirmed.
- Next major production deploy should first verify safe stage diagnostics and capture Cloudbet HTTP response; do not claim comparison works before actual same-match 1X2 outputs.
