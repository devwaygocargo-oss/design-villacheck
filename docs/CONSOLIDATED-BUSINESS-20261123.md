# Consolidated Phase2 rules — 23 November 2026

The user's consolidated Game decisions supersede contradictory older requirements. This candidate descends from company snapshot558a24ac50a537898679ea1118c8f2b00e943f11; it does not modify that published commit or authorize another push/deployment.

- Admin has daily granular operational permissions including package entitlements/payment/KYC review. Business configuration, bank, prices, subscription policy, core promotions, gateway, system and role management remain Owner-only. Payment/KYC decision audits retain actor/time/target/action/result. Account grants remain unchanged outside synthetic local tests.
- New package quotes use VAT-exclusive prices and exactly30 days. VAT rate, rounding and invoice inputs must be explicitly configured; no tax policy is fabricated. New immutable termsVersion2 snapshots coexist with historical inclusive snapshots without rewriting them. Owner catalog price changes affect only new quotes.
- Verified payment is distinct from company approval. Only the audited company decision creates/selects a new grant at server approval time, for30 elapsed days. No trial remainder, prior paid days, balance, refund or proration is carried forward. Renewal is a new manual purchase; no auto-renew worker added. Production financial activation remains gated.
- Exactly one7-day reminder is scheduled from the selected approved entitlement expiry. Existing countdown remains server-time based.
- Public QR/list/detail/media projection denies expired Phase2 grants, including trials/mixed histories; legacy expiry is checked without migrating records. Broken selections fail closed. Pending/failed/paid-but-unapproved renewal cannot restore expired information. Company approval restores the SAME QR identity. Private authorized administrative/media access remains separate.
- Original media counts are unchanged (cover1, additional images10, videos2 from existing villa media table); Basic has no video, Starter/Pro/Premium inherit the original table's video capability. Backend public metadata/file delivery checks the currently selected package; downgrade hides video without deleting bytes.
- Social fulfillment is company-managed Facebook only, with recorded publication URL visible to the Merchant. Company/Admin chooses approved Homepage Banner records; Owner still controls core promotion policy/slots. No external Social API was activated.

## Current verification commands

Node24: `npm ci`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test:backend`. Focused browser checks: `npm --prefix tools/qa ci` then `node qa-tests/phase2/run-consolidated-browser.mjs` (Chrome required). Disposable loopback PostgreSQL only; cloud credentials are scrubbed by the runner.

`test:backend`/`test:phase2` now select the consolidated focused requirements instead of assertions for superseded inclusive/auto-grant/expired-QR-continuity/preview-only behavior. The original `qa-tests/phase2/run.mjs` and historical tests remain preserved as earlier-spec evidence, not deleted or silently marked passing. Unchanged Phase1 parity/security commands remain in CI. The former291 passing executions belong to the old published snapshot; they are not claimed as rerun or as proof of this new candidate. Current focused suite includes the existing affected8 permission/audit tests plus11 changed-policy integration tests.

## Remaining release gates

This candidate is LOCAL ONLY, not covered automatically by the old87/87 publication receipt. Review/security-clear its diff and authorize any later private-company push separately; never push to public/personal repositories. Production zero-demo cleanup, exact environment/profile, Git connection/deployment, actual Game/Prin Owner grants/session acceptance and live smoke/recovery retain their separate approval gates.

Platform/domain/billing/secrets/backup/MFA custody is BUSINESS OWNER CONFIRMED; do not request it again. Outstanding unspecified Finance inputs are the actual VAT rate/rounding/invoice configuration, not the approved30-day/exclusive/manual rules. Real provider sandbox, external reminder delivery and legacy commercial-record transition are not established by local mocks. Old legacy financial write paths remain blocked in Phase2 to prevent bypassing the audited new-order workflow; no existing pending invoice is reinterpreted or migrated automatically. Any real Bank Transfer/provider acceptance must include its authorized target and historical-record handling rather than treating role-permission tests as financial acceptance.

No Production deployment/data/permission changes, real payments, cleanup or developer removal are authorized by these source changes.
