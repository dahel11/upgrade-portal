# CoLearn Upgrade Portal

Self-service retention/upgrade portal at `upgrade.colearn.id/:user_id`. See the build plan for
full context: `/Users/imamfachrudin/.claude/plans/woolly-stirring-hamming.md`.

- `src/` — Vite + React + TypeScript SPA (React Router). Requires Node >= 22.12 (see `.nvmrc`;
  `nvm use` before installing — a lower Node version fails to install Vite's rolldown native
  binding).
- `public/legacy/` — the previous Google Sheets/Apps Script-driven form, kept as-is at `/legacy`
  for reference.
- `api/schedule.js` — Vercel function proxying the class-schedule AWS endpoint.
- `supabase/functions/` — Edge Functions (`validate-invoice`, `manual-checkout`) proxying
  `package_purchases`'s internal APIs.
- `supabase/migrations/` — two files:
  - `20260724000000_create_checkout_tables.sql` — the two tables this app **owns and writes to**
    (`invoice_validations`, `checkout_transactions`), via the Edge Functions' service role.
  - `20260724000001_create_source_tables.sql` — schema for the three **read-only** tables
    (`retention_to_finances`, `retention_to_payments`, `offering_mapping_to_grade`), sourced from
    Metabase questions #4547/#4549/#4553. This app never writes to them; an external sync pipeline
    does. **Only apply this file if that pipeline doesn't already provision these tables itself**
    — otherwise just diff its column names/types against this file instead of running it, to
    avoid clashing with however the sync already defined the schema.

## Local development

```sh
nvm use
npm install
cp .env.example .env.local   # fill in your Supabase project's URL + anon key
npm run dev
```

## Deploying

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli), authenticated and linked to the
target project (`supabase login`, `supabase link --project-ref <ref>`), plus the
`PACKAGE_PURCHASES_STATIC_SECRET` value shared out-of-band by the `package_purchases` team (DEV
and PROD differ):

```sh
supabase db push                      # applies supabase/migrations/*
supabase secrets set PACKAGE_PURCHASES_BASE_URL=... PACKAGE_PURCHASES_STATIC_SECRET=...
supabase functions deploy validate-invoice
supabase functions deploy manual-checkout
```

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into Edge Functions by the Supabase
runtime — no need to set them manually.

For the frontend, set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as Vercel project environment
variables, then deploy as usual (`vercel --prod`).

## Known open items (see build plan for detail)

- The renewal flow's "Periode" display reads `payment_for_date`/`payment_till_date` straight from
  the pre-generated `retention_to_payments.meta` row — not yet verified against a real
  `monthly`/`semesterly` (non-`new_sales`) renewal row.
- `api/schedule.js`'s upstream AWS response shape hasn't been verified against a live call; see
  the normalizer comment in `src/lib/edgeFunctions.ts`.
- The "outside periode retensi" informational screen and the `pending`/`expired` tie-break when
  matching payment links use reasonable defaults, not a fully spec'd business rule.
