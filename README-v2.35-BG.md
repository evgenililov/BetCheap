# BetCheap v2.35 — Cloudbet LIVE and pre-match comparisons

Adds independent Cloudbet Affiliate Feed comparison for **LIVE and pre-match football full-time 1X2**. Requires exact category, competition, home/away team, kickoff (within 15 minutes), and matching event status (`TRADING_LIVE` for live, `TRADING` for prematch). Absent, suspended, ambiguous, or mismatched feeds never produce a comparison.

Cloudbet Affiliate Feed can be cached/delayed up to **60 seconds**. Both retrieval times are displayed; comparison is **indicative and not synchronized**, and cannot guarantee the best currently available live odds. Other sports/markets are not compared. The API key remains on the server in Netlify variable `CLOUDBET_API_KEY`. No bookmaker redirect activated.

Deploy only when ready; staging-free single Netlify Drop production deployment after existing v2.32. Production Cloudbet key authentication and real live matches must be checked after deploy.
