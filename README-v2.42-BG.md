# BetCheap v2.42 — Cloudbet timeout mitigation (NO DEPLOY YET)

## Real production finding
The deployed v2.41 Cloudbet probe returned `{"ok":false,"error":"cloudbet_timeout","stage":"competition"}`. The 1xBet API continues responding in both LIVE and Upcoming modes.

## Change
The Cloudbet competition endpoint is now queried WITHOUT `?markets=soccer.matchOdds`, reducing the size and cost of competition-list responses. The code then checks identity of the selected event (sport, country, league, home/away, kickoff, market state) and fetches `/events/{id}` for its actual market odds. Competition call abort ceiling 14 seconds; no claim that this fixes upstream timeouts until tested on Netlify. Existing fail-closed behavior stays.

## Test status
Node test suites pass including LIVE and pre-match, missing/blocked market, wrong event and secret privacy. Syntax check and ZIP integrity validated. Real Cloudbet comparison remains UNVERIFIED without Production deployment and matching published feed snapshots.

## Release rule
Do not deploy this isolated candidate before consolidating other planned changes. Deploy once; then check `/netlify/functions/cloudbet?op=probe` and compare an actual same football match in both feeds. The API may have up to ~60s affiliate lag.
