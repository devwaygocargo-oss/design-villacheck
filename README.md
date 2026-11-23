# VillaCheck private company release snapshot

Source release: `1a68bffceca4284024ad7609f63f48763109198d`.

This is a source-only snapshot with a new single-commit history. Original worktrees
and source history remain separate and unchanged. Local reports, historical evidence,
private backups, credential files and machine-specific handover documents are excluded.
Runtime code, migrations, licensed assets, synthetic tests and the company CI workflow
are retained byte-for-byte from the source release. Required business/authorization
identity metadata remains confidential and must be approved for this private destination.

Node24: npm ci; npm run build; npm run lint; npm run typecheck; npx prisma validate.
The isolated test commands are npm run test:backend,
node qa-tests/closure/run-full-phase1-parity.mjs, and
node qa-tests/approval-hotfix/run.mjs. Test transports use synthetic fixtures, not real
provider acceptance. Company GitHub Actions has no deployment or cloud-secret requirement.

No environment secret values are supplied. Obtain runtime configuration through company
platform access. Do not seed, migrate/restore Production, grant Owner roles or enable real
payments as setup steps. Existing Vercel project/domain and Neon database must be retained.

Publish only after the external security-clearance receipt matches this exact snapshot
commit and the destination is independently verified PRIVATE under devwaygocargo-oss.
Never push this snapshot or original history to the public VillaCheckTH repository.
