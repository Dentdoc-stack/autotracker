# Build status — 13 September 2026

## Current state

Working first local build, beyond the scaffold. Application and database code are implemented and locally verified. No hosted Supabase project, SMTP sender, Twilio account connection, GitHub remote, Vercel deployment, or real WhatsApp message has been created by this session.

## Implemented and usable locally

- Next.js 16.3.5 / React 19.2.8 interface: overview, instructions, details, meetings, people, reminders, settings and login/recovery screens.
- PostgreSQL persistence in the ignored `.local/postgres` directory, using the same SQL business schema as hosted mode. Local mode is loopback-only and disabled on Vercel.
- Instructions, departments, progress notes, dates/reasons/history, version-conflict checks, staff completion reports and owner confirmation/return/reopen/cancel.
- Specific dates and relative calendar-day input. All weekend meetings move to Monday; task deadlines stay unchanged. Multiple meetings, outcomes and linked follow-ups are supported.
- Contacts, recorded consent, opt-out, and office/department/task/meeting subscriptions; office-wide subscriptions are owner-only. Overlaps are deduplicated.
- Database-generated per-contact previews, exact-preview validation, mock/queued message recording, manual action limits, item-level suppression for later reminders, outbox leases and monotonic callback status processing.
- Supabase user-scoped API/auth/owner invitation integration, active-membership checks and RLS. Privileged keys remain server-only.
- Twilio Edge dispatcher and signature-verifying callback code, fail-closed secret/mode/allowlist controls, per-send revalidation and Unknown handling without blind retries.
- Cron setup SQL, owner bootstrap script, GitHub CI workflow, connection guide and private environment template.

## Verification

- Domain tests: passed, including relative dates, leap/year boundaries, Saturday/Sunday adjustment, recipient scope, completion permissions and CSV formula neutralisation.
- PostgreSQL tests: passed against PGlite, including direct-write denial, editor/owner/viewer/inactive access, actual RPC mutations, stale edits, consented subscriptions, exact-preview validation, duplicate/late-item suppression and callback ordering.
- Combined unit/database run: 33 tests passed on Node 24.19.0.
- ESLint: passed without warnings. TypeScript: passed. Next.js production build: passed.
- Both Supabase Edge Function entrypoints passed Deno type checking. Windows required DENO_TLS_CA_STORE=system to trust the configured certificate store; certificate verification was not disabled.
- Initial browser workflow passed: create instruction, calculate 12 September + 10 days, roll 26 September meeting to 28 September, reload persisted data and inspect mobile layout.
- Final browser run: both workflows passed (2 tests), including contact creation/subscription and mock reminder recording.

These local tests do not establish hosted Supabase Auth/SMTP/Cron delivery, provider template approval, or production WhatsApp delivery.

## Remaining PRD work before production

1. Connect staging Supabase, apply migrations, bootstrap owner, configure SMTP and verify actual invite/recovery. Member deactivation currently uses trusted Supabase administration; the app management screen is not implemented.
2. Connect Twilio sandbox/test sender, approve templates, validate actual variable lengths/overflow wording and test callback delivery. The current worker uses one initial template mapping rather than the PRD's complete variant set.
3. Complete bounded automatic retry policy, durable attempt history, owner reconciliation/resend UI and manually sent cancellation/date-correction workflows. Definite errors currently require operator review; uncertain submissions are never blindly retried.
4. Complete production scheduler heartbeat/independent monitoring, full outage reconciliation, scale tests, backup tooling and a restore drill. Cron setup exists but is not activated.
5. Add secondary department mappings, server-side pagination/search for production-scale data, member/department administration completeness and full date-filter UX. Current task pagination/filtering is client-side after an authorised workspace snapshot.
6. Persist relative-input provenance beyond audit request context, and finish PRD audit/cancellation history granularity. Effective dates themselves are authoritative in Postgres now.
7. Run the rest of the PRD acceptance scenarios against hosted staging, including multi-worker/network fault injection and actual sender throughput. All 40 PRD scenarios are not yet certified complete.
8. Resolve hosting eligibility, office cloud-data requirements and cost choices; run the owner-controlled pilot; obtain explicit real-recipient authorisation before enabling live sends.

## Resume instructions

Do not scaffold again. Read this file, CONNECT-SUPABASE-TWILIO.md and PRD v1.1. The next step is to inspect the preview with the user, connect staging Supabase when credentials are supplied through private settings, and complete the production gaps above. Keep the local/mock path usable while external setup proceeds.

Run `npm run dev` and open http://localhost:3000. Use Node 24 LTS. Docker is absent; local database tests use embedded PostgreSQL and a simulated auth identity. Do not reset or remove `.local` without preserving the user's local records.
