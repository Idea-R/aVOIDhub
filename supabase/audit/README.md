# Supabase production audit

This directory contains sanitized, read-only evidence for the aVOID platform recovery program.

- `production-readonly-inventory.sql` is the repeatable metadata and aggregate-data collector. It starts a read-only transaction and never selects player names, emails, user identifiers, tokens, billing identifiers, or row-level profile data.
- `production-baseline-2026-08-20.json` is the reviewed snapshot captured from Supabase project `jyuafqzjrzifqbgcqbnt` on 2026-08-20.

The snapshot is evidence, not a migration. Never apply it to a database. Any database change must be generated separately, run on an isolated development branch, pass the security and data-mapping tests, and receive production approval.

Run the repository-side integrity check with:

```powershell
node supabase/audit/verify-baseline.mjs
```
