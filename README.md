# CoLearn Upgrade Portal

Self-service retention/upgrade portal at `upgrade.colearn.id/:user_id`. See the build plan for
full context: `/Users/imamfachrudin/.claude/plans/woolly-stirring-hamming.md`.

- `src/` — Vite + React + TypeScript SPA (React Router). Requires Node >= 22.12 (see `.nvmrc`;
  `nvm use` before installing — a lower Node version fails to install Vite's rolldown native
  binding).
- `public/legacy/` — the previous Google Sheets/Apps Script-driven form, kept as-is at `/legacy`
  for reference.
- `api/schedule.js` — **pre-existing file, left untouched** (only its original pass-through-to-AWS
  behavior, unrelated to this rebuild). Whatever currently depends on it (possibly the live
  production "legacy" deployment) keeps working unmodified. Do not repurpose this file for the new
  portal — see `class-schedule.js` below instead.
- `api/class-schedule.js` — the **new** portal's own schedule endpoint. Proxies the same AWS API
  Gateway endpoint `api/schedule.js` does (fixed `sem=2&year=2026&curriculum=Kurikulum Merdeka`,
  no `frequency` param), with `subject` sourced directly from
  `offering_mapping_to_grade.subject` (per product decision, not a regex-derived guess) — separate
  file per product decision (see "don't repurpose `api/schedule.js`" above), not because the
  target differs. ⚠️ As of 2026-07-24 this endpoint returns an empty array for every
  kelas/subject combination tried in testing, including exact `subject` column values like
  "Matematika 2x/Minggu" — implemented as directed regardless; verify with whoever owns this
  endpoint that it's actually populated. (An earlier version of this file used the Google Apps
  Script webapp `public/legacy/index.html` uses instead, which *does* return real data — kept only
  as a documented fallback option if the AWS endpoint turns out to stay empty.)
- `vite-local-api-plugin.ts` — a small Vite dev-server plugin that runs `api/*.js` handlers
  in-process during `npm run dev`, so `/api/schedule` and `/api/class-schedule` both work locally
  with **no Vercel CLI dependency at all**. Exists because plain Vite doesn't execute `api/*.js`
  by default (serves the raw source text — breaks any `fetch('/api/...')` call), and `vercel dev`
  (the official alternative) has a known incompatibility with this project's SPA catch-all rewrite
  in `vercel.json`: it also routes Vite's own internal dev requests (e.g. `/src/main.tsx`) through
  the rewrite, which Vite then fails to parse as JS. See "Local development" below.
- `supabase/functions/` — Edge Functions:
  - `validate-invoice`, `manual-checkout` — proxy `package_purchases`'s internal APIs.
  - `sync-retention-finances`, `sync-retention-payments`, `sync-offering-mapping` — one function
    per Metabase question (#4547/#4549/#4553), each upserting into its own read-only source table
    (see "Metabase sync" below). There turned out to be no separate external pipeline doing this,
    so this app owns it. Deliberately split one-per-table (mirroring this org's
    `sync-ica-answer-keys`/`sync-ica-student-data` convention) after a combined single function hit
    `WORKER_RESOURCE_LIMIT` — `retention_to_payments` alone carries a sizeable JSON `meta` blob per
    row, and holding all three datasets in memory in one invocation was too much.
    ⚠️ **Deployed function slugs on the live project currently don't match these folder names** —
    they're live as `retention-finances`/`retention-payments`/`offering-mapping` (no `sync-`
    prefix), while `20260724000002_schedule_metabase_sync.sql`'s `pg_cron` jobs target the
    `sync-`-prefixed URLs. That means the 15-minute auto-refresh has likely been hitting 404 the
    whole time — not yet fixed (deferred), see "Known open items".
  - `sync-checkout-status` — syncs Metabase question #1938 ("Checkout Invoice Statuses") into
    `checkout_invoice_statuses`, keyed on `invoice_id` (= `package_purchases`'s `payments.id`,
    confirmed against `ManualPaymentService#process!`). This is the only way to observe a
    `manual-checkout`-generated invoice's payment status — `package_purchases` has no live
    status-check API and this app has no direct DB access. Used to warn a user before letting them
    generate another checkout while an earlier one is still unpaid (`fetchPendingCheckoutTransactions`
    in `src/lib/data.ts`). ⚠️ Question #1938 currently queries `package_purchases` **DEV** (matching
    `validate-invoice`/`manual-checkout`, which call `PACKAGE_PURCHASES_BASE_URL_DEV`) — re-point it
    at a PROD-connected question when this app's checkout flow itself moves to PROD. Deploy this one
    with a slug that matches the folder name exactly (`supabase functions deploy
    sync-checkout-status`) — see the ⚠️ above for why that matters.
- `supabase/migrations/`:
  - `20260724000000_create_checkout_tables.sql` — the two tables this app **owns and writes to**
    (`invoice_validations`, `checkout_transactions`), via the Edge Functions' service role.
  - `20260724000001_create_source_tables.sql` — schema for the three tables the sync functions
    populate (`retention_to_finances`, `retention_to_payments`, `offering_mapping_to_grade`).
  - `20260724000002_schedule_metabase_sync.sql` — three `pg_cron`/`pg_net` jobs (one per sync
    function, offset a couple minutes apart so they don't compete for resources at the same tick),
    every 15 minutes. Read the comment at the top before applying — it requires a one-off Vault
    secret setup first.
  - `20260724000003_relax_source_table_constraints.sql` — loosens `due_date`/`monthly_price`/
    `semesterly_price` to nullable; real Metabase data leaves these blank on a meaningful share of
    rows (older/inactive records) and a blank string fails a `NOT NULL` typed column.
  - `20260724000004_flatten_retention_payments_contact_fields.sql` — drops `retention_to_payments`'
    `meta` jsonb column (a ~1.5KB/row blob, mostly finance/invoice detail for a past checkout) and
    replaces it with just the ~15 scalar fields actually used (contact identity + a few
    pricing/period fields). Re-run `sync-retention-payments` after applying.
  - `20260724000005_add_offering_subject_column.sql` — adds `offering_mapping_to_grade.subject`
    (e.g. "Matematika", "IPA"), now that Metabase question #4553 includes it. This is the
    authoritative subject name — the frontend previously guessed it by regex-stripping `name`
    (`subjectDisplayName`/`subjectFamily` in `src/lib/format.ts`), which broke down for anything
    not following the "X Nx/Minggu - Kelas N" pattern. `computeOfferingSelection` (same-subject
    frequency-upgrade detection) and the schedule API's `subject` param now both prefer
    `OfferingMapping.subject`, falling back to the regex guess only for rows synced before this
    column existed.
  - `20260729000002_create_checkout_invoice_statuses.sql` — schema for `checkout_invoice_statuses`,
    the table `sync-checkout-status` populates from Metabase question #1938.
  - `20260729000003_schedule_checkout_status_sync.sql` — `pg_cron`/`pg_net` job for
    `sync-checkout-status`, every 5 minutes (faster than the other three's 15-minute cadence, since
    stale status here directly weakens the unpaid-transaction warning). Same Vault secret
    prerequisite as `20260724000002`.
  - `20260729000004_allow_anon_read_checkout_transactions.sql` — adds an anon SELECT policy to
    `checkout_transactions`, which originally had none (see `20260724000000`'s comment — "the
    frontend never needs to read these tables directly"). That assumption changed: the frontend now
    lists a user's own generated transactions to warn before letting them generate another one.
    Same trust model as every other anon-readable table here (no Supabase Auth session; the
    URL's `user_id` is the only access boundary) — only SELECT is opened, writes stay
    service-role-only.

## Local development

```sh
nvm use
npm install
cp .env.example .env.local   # fill in your Supabase project's URL + anon key
npm run dev                  # (or: npm start — same thing)
```

Both the frontend and `/api/schedule` / `/api/class-schedule` work out of the box — no Vercel CLI,
no deployed instance needed (see `vite-local-api-plugin.ts` above). If a *new* `api/*.js` file is
ever added, it works locally the same way automatically, as long as it uses the same
`(req, res) => {...}` shape with `req.query` and `res.status(code).json(body)` /
`res.setHeader(...)` — the plugin only implements that subset of Vercel's Node runtime API, not
the full surface (e.g. no request body parsing, no streaming responses).

## Deploying

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli), authenticated and linked to the
target project (`supabase login`, `supabase link --project-ref <ref>`), plus the
`PACKAGE_PURCHASES_FINANCE_TOKEN_DEV` value shared out-of-band by the `package_purchases` team (DEV
and PROD differ):

```sh
supabase db push                      # applies supabase/migrations/*
supabase secrets set PACKAGE_PURCHASES_BASE_URL_DEV=... PACKAGE_PURCHASES_FINANCE_TOKEN_DEV=...
supabase functions deploy validate-invoice
supabase functions deploy manual-checkout
```

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into Edge Functions by the Supabase
runtime — no need to set them manually.

For the frontend, set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as Vercel project environment
variables, then deploy as usual (`vercel --prod`).

### Metabase sync

Each `sync-*` function calls Metabase's own API, so they need their own secrets, and they're
invoked by `pg_cron` (not by a logged-in Supabase user), so they're deployed without JWT
verification and guard themselves with a shared secret instead. Each fetches via the CSV export
endpoint (`/api/card/:id/query/csv`) and parses it manually — matching the pattern already proven
working in this org's other Metabase sync function (`sync-ica-answer-keys`); the JSON export
endpoint (`/query/json`) 404'd against this Metabase instance. The same secrets are shared across
all three functions:

```sh
supabase secrets set METABASE_BASE_URL=https://metabase.colearn.id METABASE_USERNAME=... METABASE_PASSWORD=...
supabase secrets set METABASE_SYNC_SECRET=$(openssl rand -hex 32)   # save this value, you need it again below
supabase functions deploy sync-retention-finances --no-verify-jwt
supabase functions deploy sync-retention-payments --no-verify-jwt
supabase functions deploy sync-offering-mapping --no-verify-jwt
supabase functions deploy sync-checkout-status --no-verify-jwt
```

⚠️ Double-check after deploying that the live slug matches the command above exactly (e.g.
`supabase functions list`) — see the ⚠️ under `supabase/functions/` above about the other three
having drifted to shortened slugs that no longer match their `pg_cron` job's target URL.

Then, in the Supabase SQL editor (one-off, do **not** commit this — it embeds the secret value):

```sql
select vault.create_secret('<same value as METABASE_SYNC_SECRET above>', 'metabase_sync_secret');
```

Then apply `20260724000002_schedule_metabase_sync.sql` and `20260729000003_schedule_checkout_status_sync.sql`
(after replacing `<project-ref>` in each with this project's ref) to schedule the recurring pulls.
To test each one immediately without waiting for the cron tick:

```sh
curl -X POST https://<project-ref>.supabase.co/functions/v1/sync-retention-finances -H "x-sync-secret: <value>"
curl -X POST https://<project-ref>.supabase.co/functions/v1/sync-retention-payments -H "x-sync-secret: <value>"
curl -X POST https://<project-ref>.supabase.co/functions/v1/sync-offering-mapping -H "x-sync-secret: <value>"
curl -X POST https://<project-ref>.supabase.co/functions/v1/sync-checkout-status -H "x-sync-secret: <value>"
```

Each returns its own `{ fetched, upserted, failed }` counts (or an error) so you can confirm the
table synced correctly — check them one at a time rather than all three (four) at once.

`sync-retention-payments` needed three fixes to stop hitting `WORKER_RESOURCE_LIMIT` at ~18k rows:
1. Its own function (not combined with the other two datasets).
2. Streaming the Metabase CSV response (chunk by chunk, parsing + upserting incrementally) rather
   than buffering the whole file.
3. **The actual fix**: Metabase question #4549 itself was edited to extract only the ~15 scalar
   fields this app reads directly via Postgres `->>`/`->` JSON operators, instead of returning the
   whole ~1.5KB/row `meta` JSON blob — see
   `supabase/functions/sync-retention-payments/metabase-question-4549.sql` for the edited SQL.
   Extracting those fields *after* fetching (in the Edge Function) still meant transferring and
   parsing the full blob for all ~18k rows first; #1 and #2 alone weren't enough. Corresponding
   Supabase schema: `20260724000004_flatten_retention_payments_contact_fields.sql` (no `meta`
   column at all anymore).

The other two sync functions are small enough that the simpler buffer-then-batch approach (no
source-query changes, no streaming) is fine.

**Separately**: the Metabase question's `id` column must be `payments.id`, not
`retention_entries.id` — one retention entry can have multiple payment rows (e.g. a monthly-tenor
link and a semesterly-tenor link for the same due cycle), so using the entry's id as the upsert key
put two rows with the same key in one batch, which Postgres rejects ("ON CONFLICT DO UPDATE
command cannot affect row a second time"). Already fixed in `metabase-question-4549.sql`.

## Known open items (see build plan for detail)

- The renewal flow's "Periode" display reads `payment_for_date`/`payment_till_date` straight from
  the pre-generated `retention_to_payments` row's flat columns — not yet verified against a real
  `monthly`/`semesterly` (non-`new_sales`) renewal row.
- The "outside periode retensi" informational screen and the `pending`/`expired` tie-break when
  matching payment links use reasonable defaults, not a fully spec'd business rule.
- The `sync-*` functions' CSV parser correctly un-escapes `""` inside quoted fields (needed for
  parsing the source `meta` JSON before extracting fields from it in `sync-retention-payments`)
  but still assumes no field contains a literal embedded newline — unlikely since `meta` isn't
  pretty-printed, but worth keeping in mind if a sync ever reports a `JSON.parse` error again.
- Real Metabase data has holes (blank `due_date`, `monthly_price`, `semesterly_price` on
  older/inactive rows) — if a future sync fails with `invalid input syntax for type ... : ""`,
  the fix is the same pattern as `20260724000003_relax_source_table_constraints.sql`: null out the
  blank value in the function's `coerce()` and relax the column if needed.
- **`sync-retention-finances`/`sync-retention-payments`/`sync-offering-mapping` are deployed under
  shortened slugs** (`retention-finances`/`retention-payments`/`offering-mapping`, no `sync-`
  prefix) that don't match `20260724000002_schedule_metabase_sync.sql`'s `pg_cron` target URLs
  (which use the full `sync-`-prefixed names) — confirmed by probing the live functions directly.
  The 15-minute PROD auto-refresh has likely been hitting 404 this whole time, meaning
  `retention_to_finances`/`retention_to_payments`/`offering_mapping_to_grade` may be stale. Fix:
  either redeploy the three functions under their folder-name slugs, or update the cron job URLs to
  match the live slugs — not yet done (deferred while dev/test setup was more urgent).
- `validate-invoice`/`manual-checkout` currently call `package_purchases` **DEV**
  (`PACKAGE_PURCHASES_BASE_URL_DEV`), while `retention_to_finances`/`retention_to_payments`/
  `offering_mapping_to_grade` sync from Metabase **PROD** — so most synced rows reference
  users/offerings `package_purchases` DEV has never heard of. `offering_mapping_to_grade_dev` (a
  full DEV-sourced mirror, populated manually — see `src/lib/data.ts`'s
  `fetchOfferingMappingForGrade`) works around this for offerings; `retention_to_finances`/
  `retention_to_payments` currently only have this worked around for a single hand-inserted test
  user directly in the PROD-shaped tables (not yet split into `_dev` counterparts — discussed, not
  yet applied).
