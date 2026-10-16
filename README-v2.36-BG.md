# BetCheap v2.36 — actual two-operator comparison fixes

- Fixed Cloudbet market endpoint filter to `soccer.match_odds` per the public Cloudbet market specification, instead of `soccer.matchOdds`.
- Kept both aliases accepted when parsing an upstream response, with the documented snake_case form first.
- On selecting any match, the comparison table is always visible. 1xBet is displayed first, Cloudbet is `—` until a same-event match with tradeable full-time 1X2 odds is found.
- Clear failure reasons; no false comparative "winner" while missing data.
- Separate upcoming and LIVE, 60-second indicative Cloudbet lag, no GEO bypass or affiliate redirection.
- Cloudbet diagnostics return no credentials and only metadata about missing markets/events.
- Requires one production deploy to test with stored Cloudbet key. End-to-end two-feed comparison is NOT confirmed until live odds from both appear for the exact same match.
