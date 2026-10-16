# BetCheap v2.40 — general QA / operator selection candidate

- 1xBet and Cloudbet comparable table quote values are actionable selection-review controls.
- A selected Cloudbet price is identified as Cloudbet, never silently sent to 1xBet.
- No Cloudbet event-level redirect is claimed until officially documented and verified; no unverified redirects.
- 1xBet routing remains controlled by geo/legal/operator tracking verification flags.
- Cloudbet diagnostic `/.netlify/functions/cloudbet?op=probe` returns safe upstream status/shape, no token.
- Existing age gate, market tabs, share card, alert, refresh, and privacy continue to be included.
- Local tests DO NOT prove user affiliate reporting or legal permission; production test required after single consolidated deployment.
