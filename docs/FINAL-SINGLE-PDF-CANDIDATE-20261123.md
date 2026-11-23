# Final single-PDF handover candidate — 23 November 2026

Production remains 2c0b088bf79c5f223f40d5a8ad44e90160ffd2a6.

Two confirmed in-scope presentation defects:

- Phase2SocialJobs offered Instagram/TikTok when TEAM was selected despite the existing server Facebook-only policy. The company-policy UI now exposes Facebook for TEAM and PACKAGE and normalizes channel on source changes. The legacy facebookOnly=false rendering remains unchanged.
- At mobile width390, a long existing Social job option made the single-column grid exceed the viewport. Constrain the mobile grid track and item/select intrinsic minimum widths; do not hide overflow or remove content.

No backend business logic, schema, dependencies, environment, grants, payment configuration or data migration changes. No production changes.

Focused local native-browser verification: two synthetic DB/API guard contexts and two authenticated UI flows (1440/390), including repeated TEAM/PACKAGE switches, valid Facebook acceptance, rejected non-Facebook no-write assertions and document horizontal geometry. Four final cases PASS. Before-fix failures retained outside source in the private handover evidence package. Documentation screenshots use a taller capture viewport only after the assertions, to prevent sticky-header occlusion.

Build, lint, typecheck, syntax checks and diff whitespace checks passed. Existing passing broad application suites are retained, not rerun. Prior QA/docs-only commits remain ancestors.

Company main PDF and evidence ZIP are local private handover artifacts. Provider-console screenshots are not fabricated; console walkthrough remains unverified without the account holder's authorized browser session. No incoming developer is assumed. Game/Prin PENDING, actual QR transition DEFERRED, Provider TEST/Finance/notification gates remain. Formal matrix retains current-production FAIL for the two UI defects until a separately approved exact-SHA deployment and actual verification.

No push/deploy is authorized for this new candidate by this document.
