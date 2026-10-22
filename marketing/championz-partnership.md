# Champion Z — attribution and payment proposal

Prepared 22 October 2026. Not an agreed contract. No campaign or payment is authorized by this document.

## Implemented first-party campaign measurement

After deployment: `https://betcheap.netlify.app/?ref=championz`.

The code is case-sensitive, allowlisted and not a bookmaker bonus code. Only visitors who allow measurement generate records. A random, signed token in sessionStorage lasts at most 24 hours, for the current tab. Each action category is deduplicated per token: visit, comparison rendered with at least one common selection, and clicks to each operator. Different tabs/devices or newly accepted sessions may count multiple times. Declined visits are not measured. This is not a unique-person count. Measurements are client-reported and can be manipulated; they never authorize payouts. Browser failures, blockers, navigation races and direct external affiliate URLs can omit events.

Owner report: `/referral-report.html`, using the existing Telegram setup owner secret. It is never shared with Champion Z or stored by the report page. Report date is the UTC session start date; actions on the following day are credited to that start date. Results over 10,000 records are marked truncated. No IP, user name, bookmaker account, event selection or screenshot is stored in this feature. Hosting access logs are separate. Daily cleanup removes records older than 31 days, up to 10,000 per run. Monitor scheduled-function failures/backlog.

There is no change to operator destinations, no invented sub-ID parameter and no assertion that a visitor made a bet. The report exposes `qualifiedCustomers: null` and `commissionDue: null` deliberately. The referral tag is NOT passed to operators yet. Existing Telegram bot/channel links do not preserve this campaign; use the app link directly for the test.

## Required before performance-based promotion starts

Ask the affiliate manager for the intended operator:

> We operate BetCheap and want to distinguish traffic from one marketing partner, campaign code championz. Please confirm whether our agreement permits this marketing/sub-affiliate arrangement, the approved channels and countries (including Nigeria), the exact supported campaign/sub-ID tracking method, and how it appears in registration, qualifying-bet and commission reports. Please provide a campaign-specific link generated under our account and explain the conversion criteria, approval delays, reversals and payout terms. We will not invent URL parameters or start promotion before this is confirmed.

A site opening from Nigeria is not proof of permitted advertising, customer eligibility or affiliate remuneration. Verify those with the operator. Once the approved tracking link/report schema exists, implement passing the campaign, then reconcile a permitted test in the operator report. Do not create duplicate accounts or place test bets to manufacture commission. Do not share player personal data with the promoter.

## Suggested commercial terms

Recommendation: 20% of commission actually received by BetCheap and attributable to Champion Z's confirmed, qualifying referrals; 80% stays with BetCheap. This is a proposed negotiating point, not a market benchmark. No upfront payment, payment per view or payment per click. Never describe it as a share of deposits, stakes or winnings.

Example: EUR 100 received in attributable commission → EUR 20 for Champion Z and EUR 80 for BetCheap, before BetCheap's operating costs and taxes. EUR 0 attributable commission received → EUR 0 due. Pending or rejected conversions do not create a payment obligation.

If the operator pays CPA, the same 20% applies to the confirmed CPA actually paid. If it pays recurring revenue share, the same percentage can apply to subsequent amounts from the agreed referral cohort, but only within the duration explicitly agreed with Champion Z. Neither recurring income nor perpetual attribution is guaranteed.

Proposed initial period: one month of promotion after tracking validation. Before starting, agree in writing on both the promotion period and the separate duration for sharing commission from those customers, how operator adjustments/reversals are handled, currency/conversion basis, transaction fees, minimum payout if any, and the end-of-arrangement rules. Use a precise commission basis: amount credited and actually paid for his referrals after operator adjustments; do not subtract arbitrary unrelated BetCheap costs. Any negative carryover follows the operator/account rules and must be disclosed.

Suggested settlement: monthly statement, payment within 10 business days after BetCheap receives the relevant operator payment. Provide aggregate operator-backed results with unrelated customers and personal details redacted. No financial figures are generated from first-party browser metrics.

Do not offer a fixed amount per customer until the operator's CPA and qualification rules are known. A fixed fee may exceed the commission earned.
