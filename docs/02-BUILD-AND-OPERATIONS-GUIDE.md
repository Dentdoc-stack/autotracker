# ACS(G) Tracker — AI Build and Operations Guide

Companion to `01-PRODUCT-REQUIREMENTS.md`, version 1.1, 12 September 2026. Includes team-managed multiple recipients and recipient-specific digests.

This is a staged implementation guide, not prewritten application code. The AI implementer must produce and test the real SQL, handlers, screens, and deployment configuration at each stage. Do not paste guessed credentials or run production commands before checking the selected project. Complete stages in order; external account setup can progress while mock development continues.

## 1. Who does what

| Owner / human | AI coding assistant |
|---|---|
| Own GitHub, Supabase, Vercel, Twilio accounts | Build application, schema, migrations, tests, and runbooks |
| Confirm approved office data/hosting and any spending | Check current provider docs and report actual costs/limitations |
| Enter passwords, billing, verification documents, MFA, and secrets in provider UI | Supply exact setting names and safe instructions; never request secrets in chat |
| Provide actual department list, invited emails, ACS(G) number and opt-in | Seed authorised values, implement invitations and validation |
| Approve actual production-recipient messaging | Keep mock/test modes enforced until that approval |
| Review workflow and operate exceptions | Demonstrate acceptance tests and fix failures |

Account creation and subscriptions are not performed by these documents. Use the smallest access scope; office staff need app invitations, not infrastructure credentials.

## 2. Project layout and checkpoints

Create a new private project named `acs-g-tracker` inside a new folder; do not reuse or alter the old `weekly-console` application. Copy these three documents into the new project's `docs/` directory. Keep one source repository with the app, Supabase migrations/functions, tests, and deployment scripts.

```text
acs-g-tracker/
  docs/                         PRD, guide, handoff, decisions, progress, runbook
  src/app/                      login, dashboard, tasks, meetings, reminders, settings
  src/app/api/                  authenticated route handlers
  src/lib/supabase/              browser/server/admin clients and auth refresh
  src/lib/domain/                schemas, date previews, safe presentation
  src/components/                shared accessible form/table/feedback components
  supabase/migrations/           schema, permissions, RPCs, indexes, cron changes
  supabase/functions/            dispatcher and Twilio callback
  supabase/functions/_shared/    template rendering, provider adapter, errors
  tests/unit/                   dates, grouping, message and transition cases
  tests/integration/            real local Postgres permissions and RPCs
  tests/e2e/                    owner/editor/viewer workflows in browser
  scripts/                      backup/restore verification and environment checks
  .env.example                  names and descriptions only
  README.md                     setup, pinned versions, commands, environments
```

At every stage, update `docs/BUILD-STATUS.md` with completed work, checks and results, remaining work, blockers, and the next exact step. Commit related changes after verification. Do not mark a stage complete if its exit check fails. New requirements go into `docs/DECISIONS.md` and the PRD; do not silently invent additional services or change business rules.

## 3. Stage A — foundation and local environment

1. Read the PRD and enumerate AT-01 through AT-40 in a test checklist.
2. Check the workstation for a current supported Node LTS, npm, Git, Docker Desktop, and Supabase CLI. Install missing prerequisites only within the owner's authorised environment.
3. Create the private repository and scaffold Next.js using TypeScript, App Router, Tailwind, ESLint, and `src/`. Record exact versions and the Node runtime in the README; commit the lockfile.
4. Add `@supabase/supabase-js`, `@supabase/ssr`, Zod, a timezone-capable date library, Vitest, Playwright, and the Supabase CLI as appropriate. Avoid deprecated Supabase auth helper packages.
5. Initialise Supabase locally, start it with Docker, and record local service URLs without passwords in documentation. No local command should target a hosted production project.
6. Create explicit mock/test/live messaging configuration. Mock must be the default; tests must assert no network call can reach Twilio in mock mode.
7. Set up typecheck, lint, unit, integration, browser, and production-build scripts. Add CI checks to the private repository without production secrets.
8. Create a basic private app shell and login route; use synthetic data only until schema/auth are done.

Example local commands (the AI must first verify compatible installed versions):

```powershell
npx create-next-app@latest acs-g-tracker --typescript --tailwind --eslint --app --src-dir --use-npm
Set-Location acs-g-tracker
npm install @supabase/supabase-js @supabase/ssr zod date-fns @date-fns/tz
npm install -D supabase vitest @playwright/test
npx supabase init
npx supabase start
```

Exit: app runs locally, CI scripts exist, local Supabase is reachable, no live credentials are present, and all chosen versions are pinned. A scaffold alone is not Stage B completion.

## 4. Stage B — database and permissions first

1. Create migrations in this order: enums/base entities; tasks/departments/meetings/history; memberships and RLS; transactional RPCs; notification outbox/claims/events; operational views/indexes. Cron activation is deferred.
2. Implement authoritative SQL functions for relative dates and weekend roll-forward. Write date tests before connecting forms. Mirror only preview behaviour in TypeScript and compare it against SQL fixtures.
3. Implement the minimum model in PRD section 8, including CHECK constraints and foreign keys. Make multi-department joins unique; preserve historical department names in sent snapshots. Implement contacts, phone normalisation, scoped subscriptions, and manual-request parents; there is no singleton recipient table. Enforce office-wide subscription permission in SQL and deduplicate overlapping scopes per contact.
4. Enable RLS on every exposed table. Anonymous receives no application data. Active viewers can select safe task/meeting information; editors have the PRD access scope. Operational/settings tables have owner or worker-only access.
5. Revoke direct table mutations from app users for protected entities; grant only narrowly scoped RPC operations. Security-definer RPCs explicitly check auth.uid(), membership.active, and role, and use a safe search_path. Restrict privileged worker RPCs to the worker/service identity.
6. Put task+initial-meeting creation, state transitions, date edits+audit, and message claims in transactions. Server controls actor/time/reference/revision/effective_date. A direct REST caller must not bypass owner-only completion.
7. Implement expectedVersion comparisons and atomic increments. Changes to reminder-relevant dates/state use a reminder revision and its timestamp distinct from the general edit version. The timestamp supports the daily 09:00 cutoff; normal note edits must not make an existing event look newly scheduled.
8. Implement audit/history generation in the mutation transaction. Editors cannot erase notes or audit rows. Support deactivation, not destructive identity removal.
9. Generate TypeScript database types from the local schema and commit them. Add a CI check for migration/type drift.
10. Test through real user-scoped Supabase clients for anonymous, owner, editor, viewer, inactive member, and unrelated authenticated account. Include direct RPC and REST attacks, not just disabled buttons.

Useful commands once scripts/migrations exist:

```powershell
npx supabase migration new initial_schema
npx supabase db reset
npx supabase gen types typescript --local
npm run test:integration
```

`db reset` is local-only in this guide. Capture generated types to the project file using a safe UTF-8 file write. Never reset or seed synthetic data into production.

Exit: clean local rebuild succeeds; AT-01–09, AT-23–24 and concurrency tests pass; no public table permits unauthorised writes.

## 5. Stage C — create and connect hosted Supabase

### Human account setup

1. Sign in at Supabase; enable MFA for the account and keep recovery information securely.
2. Create `acs-g-tracker-staging` on the selected eligible plan. Choose a region appropriate to office data approval and latency; record it before data is loaded. Generate/store the database password in a password manager.
3. In the project Connect/API settings, identify project URL, publishable key, project reference, and privileged server credential. Do not paste secret values into chat or commit them.
4. Keep staging and production as separate projects. Use local development to avoid requiring more hosted projects than the account permits. Create production only when stage gates permit it.

### AI connection steps

1. Add local/staging environment files excluded by Git. `.env.example` contains names only.
2. Create separate Supabase browser, per-request server, and server-only admin clients. The admin module must refuse client-side import.
3. Implement the current supported Supabase SSR cookie refresh pattern for the pinned Next.js version. Validate identity with supported verified claims/user methods, not an unverified session object; membership lookup controls app access. [Supabase SSR setup](https://supabase.com/docs/guides/auth/server-side/nextjs).
4. Connect the CLI to staging only after displaying/checking its project reference. Review pending migration diff, then apply versioned migrations. Do not hand-edit hosted schema without capturing it in migrations.
5. Seed only approved departments and synthetic staging examples through repeatable scripts. Bootstrap the owner's auth account with provider-supported account creation, then provision its owner membership using a documented trusted setup script. No public API can bootstrap an owner.
6. Verify anonymous and unlisted accounts remain blocked on hosted staging. Test one read/write round trip and history persistence across refresh/restart.

Environment inventory:

| Name / concept | Location | Notes |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Next.js local/staging/production | Correct project URL for that environment |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Next.js | Public by design; RLS is required |
| SUPABASE_ADMIN_KEY | Next.js server only | Privileged account invitation operations only; map to supported provider secret/service credential |
| APP_BASE_URL | Next.js and worker config | Canonical HTTPS URL; local development exception |
| APP_ENV | App and worker | local/staging/production; fail closed if absent |
| MESSAGING_MODE | Worker secrets/config | mock/test/live; deployment setting bounds app setting |
| TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN | Worker secret store only | Auth token also needed to verify callbacks |
| TWILIO_WHATSAPP_FROM | Worker secret/config | Approved sender with whatsapp: prefix |
| REMINDER_CRON_SECRET | Supabase Vault and worker secret | Strong random shared scheduler credential; never a publishable key |
| TEST_RECIPIENT_ALLOWLIST | Worker secret/config | Explicit owner-controlled E.164 test numbers |
| SMTP settings | Supabase Auth settings | Host, port, user, password, sender; not public environment variables |
| Database connection password/URL | Local secure config or backup runner secret | Never in frontend or command logs |

Supabase Edge Functions already provide platform environment values for connecting to their project; inspect supported names in the pinned runtime rather than creating conflicting reserved-name secrets.

Exit: hosted staging is schema-identical to local, login-independent RLS checks pass, and environment separation is proven.

## 6. Stage D — invitations, login, recovery

1. Disable public signup in Supabase Auth settings. Implement email/password login and logout, invitation acceptance, and recovery routes.
2. Configure an approved SMTP sender. Use existing authorised office SMTP if available. Otherwise show the owner a verified provider/domain cost choice; this is an external launch dependency, not a reason to fake email success. Supabase's built-in mail service has restrictions and is not the production plan. [SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).
3. Set Supabase Site URL to the deployed staging origin. Add only exact required local/staging auth callback URLs. Production gets its own origin and redirect allowlist; avoid broad wildcard production redirects.
4. Owner invitation action validates role editor/viewer, creates/sends an invite through the server admin client, and provisions the membership idempotently. If one side fails, leave the account inaccessible and provide a safe retry, never a half-authorised role.
5. Implement recovery link handling with explicit redirect allowlisting and clear expired-link/resend states.
6. Account deactivation is checked on every page/data mutation via active membership, even while the auth JWT is still valid. Logout clears session cookies.
7. Test actual invite and recovery delivery to one owner-controlled email. Record delivered result and working callback, without recording secret links in public logs.

Exit: owner/editor/viewer can sign in with correct scope, recovery works, and disabled/uninvited users cannot access records.

## 7. Stage E — staff workflow and meeting agenda

1. Build Add task with the required fields, primary department and optional secondary departments. Allow deadline, meeting, both, or unscheduled. Show computed dates and reminder preview.
2. Build task list, filters, pagination and details, including progress notes and next meeting.
3. Implement direct staff timeline edits with reason and version checks. Preserve original date and all revisions.
4. Implement completion report, owner confirmation/return/reopen/cancel, and explicit handling of outstanding meetings.
5. Build initial/review/follow-up meeting forms, proposed/confirmed/held/cancelled states, time/venue, actual outcome/date and Add follow-up after N days.
6. Build meeting agenda with weekend badges: Requested Sat 26 Sep → Scheduled Mon 28 Sep. Make proposed versus confirmed obvious.
7. Build Contacts management and task/meeting/department recipient selectors for editors and owner, with phone deduplication and consent. Build per-recipient daily preview from the same server query/renderer used by sending. Show recipient count, scope and message differences. No separate frontend approximation of eligibility or automatic app-account creation for contacts.
8. Add manual late/correction actions, conflict feedback, and immutable message history shell before real sending.
9. Add CSV export for authorised editors and owner; neutralise formula injection.
10. Test mobile, keyboard use, error/empty states, and the exact example workflow end to end.

Exit: all core workflows work against Supabase with mock messaging; no browser-only authoritative data or fake success state remains.

## 8. Stage F — prove WhatsApp production feasibility early

Do this while Stage E is being developed, before investing in complex message formatting.

### Human/provider steps

1. Create/use an office-owned Twilio account and enable account security. Confirm with Twilio that the government entity and intended recipient use case can be onboarded. The WhatsApp policy requires government access through a solution provider. [Policy](https://whatsappbusiness.com/policy/).
2. Use the Twilio sandbox initially with an owner-controlled phone that has explicitly joined it. Sandbox success is not production sender approval.
3. Follow Twilio's production WhatsApp sender onboarding: office business identity, Meta business account requirements, permitted number ownership/verification, and any provider review. Do not assume an existing personal number can be moved without consequences.
4. Record each contact's consent to this specific task/meeting reminder purpose. Editors may add consenting contacts and task/meeting/department subscriptions directly. The owner configures ACS(G)'s all-office subscription. Keep test allowlist enforcement during the pilot; no unlisted phone may be reached in staging. Obtain actual sender throughput and recipient limits for the account.
5. Submit representative daily digest templates for one through five task groups, overflow count-and-link, and manual/date-change/cancellation templates. Use synthetic samples, fixed labels, and separate single-line variables. Check actual approved length/category constraints. [Template guidance](https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates).
6. Record approved ContentSids and variable maps. If a variant is rejected, revise its wording and resubmit; do not replace it with unsupported free-form production sends.
7. Record actual pricing: Twilio fee, Meta rate/category for destination, sender fees, taxes, and any minimum funding requirement. The PRD's $0.15/$0.30 examples are Twilio-only arithmetic.

### AI integration steps

1. Define a provider adapter with `sendApprovedTemplate`, returning provider SID and safe result metadata. Provide a deterministic mock adapter for all failure modes in AT-18–20.
2. Implement Twilio calls only from the Supabase worker. Set From/To correctly, ContentSid, JSON ContentVariables, and an HTTPS StatusCallback containing the application's message correlation ID.
3. Validate all chosen template mappings before live mode can be enabled. Preview the exact rendered variable values and compare against provider template limits.
4. Store credentials in Supabase Edge Function secrets, not task tables, client code, or repository. Deploy a signature-verifying callback endpoint.
5. Validate callback URL/form signatures using Twilio's supported helper in the chosen Edge runtime. Prove compatibility in staging; do not silently omit validation if a library import fails.
6. Test signed callback acceptance, forged callback rejection, duplicate events, delivered-before-sent event order, failure callbacks, and callback arriving before submission persistence.

Exit: approved template configuration and actual authorised test-number delivery are proven. If government onboarding/template approval is pending, report messaging as blocked and continue application/mock work.

## 9. Stage G — outbox, scheduling, and manual sends

1. Implement database daily-run creation, event occurrence claims, outbox leases, immutable snapshots and attempts. Enforce uniqueness in SQL, not a read-then-insert frontend check.
2. Implement deterministic candidate selection for tomorrow at 09:00 Pakistan time with the fixed-cutoff and 09:30 catch-up limit specified in the PRD.
3. Implement manual preview hash and revision validation, idempotency keys, safe correction sending, early/normal/correction occurrence claims and persistent rate limits. Manual sending is staff-triggered and may run outside the morning schedule.
4. Implement bounded retry/Unknown behaviour. Use fault injection to crash after provider acceptance and before local persistence. A lease expiry must not duplicate a possibly accepted message.
5. Deploy `reminder-dispatch` Edge Function with explicit application-level scheduler-secret authentication. A publishable Supabase API key alone is not authorisation to send. If gateway JWT verification is disabled for this function, custom secret verification must run before all work. The callback has separate Twilio signature authentication.
6. Enable `pg_cron`, `pg_net`, and Vault in Supabase. Store project endpoint and scheduler secret in Vault; invoke the dispatcher every minute over HTTPS. [Supabase scheduling guide](https://supabase.com/docs/guides/functions/schedule-functions).
7. Implement a migration/setup command that creates exactly one named job, `acs-g-reminder-tick`, or updates that job idempotently. Never create an extra job each deployment. Cron runs every minute; business-time selection happens inside the dispatcher/database.
8. Restrict automatic sends to production live mode, enabled opted-in contacts, applicable subscriptions and approved configuration. Snapshot eligibility at cutoff and recheck immediately before sending. Create one child outbox message per contact in bounded batches; isolate failures and continue the queue across worker ticks. Staging cron may run mock or allowlisted test mode only. The app's owner switch cannot override an environment-level mock/test restriction.
9. After deployment, inspect Cron run history, dispatcher heartbeat, outbox and callback records. Run a scheduled test for a controlled date/time using an isolated test clock; no production clock override should be exposed through a public route.
10. Verify manual timing, cutoff, no-items and outage paths. Retry and daily jobs use the same worker; no extra hosted queue is required.

Exit: AT-10–22, AT-26–27 and AT-33–40 pass, including multi-recipient concurrency, batch continuation and crash injection. A mocked provider success alone does not satisfy the real delivery check.

## 10. Stage H — Vercel deployment and production settings

1. Resolve whether the intended office usage qualifies for Vercel Hobby. The public plan is described as personal, non-commercial; do not label this office build permanently free without confirmation. If ineligible, obtain the owner's hosting/budget decision before production deployment. [Vercel pricing](https://vercel.com/pricing).
2. Import the private repository into Vercel. Use its Next.js framework detection and the project's pinned Node runtime. Do not put Supabase database or n8n inside Vercel filesystem storage.
3. Configure Preview variables to point exclusively to staging; Production variables point to the production Supabase project. Preview must not contain production admin keys or messaging secrets. Twilio secrets remain in Supabase, not Vercel.
4. Deploy staging/preview, then configure its exact Supabase Auth URLs and application base URL. If deployment protection prevents a needed callback, use the public signature-verified Supabase callback URL, not an unprotected app-data route.
5. Create production Supabase, apply reviewed migrations, deploy Edge Functions with live sending disabled, and configure production SMTP/auth redirects. Do not clone sandbox recipients or demo tasks into production.
6. Bootstrap the actual owner, approved departments, and consented contacts/subscriptions with global sending disabled pending the live test. Verify deployed app has HTTPS, private pages, security headers, no client secrets, and no accidental static caching of authenticated pages.
7. Smoke-test task creation, meeting adjustment, staff/owner separation, message preview and recovery on the production domain using authorised test data.
8. Activate automatic sends only after the release checklist and explicit recipient test approval. Keep a visible emergency Disable automatic reminders action.

Exit: production infrastructure configured, cost/eligibility documented, smoke tests pass, and deployment can be rolled back without reverting the database destructively.

## 11. Stage I — backups, monitoring, and owner runbook

### Backup plan for a lean deployment

1. Provide an operator-run backup script that exports the application schema/data and an auth-user-ID/email mapping using supported administrative APIs. Never export plaintext passwords. Exclude cron jobs and Vault secrets from the portable application dump; recover them separately from secure settings.
2. Default free-tier operation: the designated office operator runs an encrypted backup every calendar day, including weekends, and before migrations. Daily message and audit records also need protection even when staff make no task edits. A daily scheduled runner may replace this only after an approved always-available environment/storage is identified. State the actual coverage; do not claim unattended daily backups if none exists.
3. Encrypt with an owner-held key and store outside Supabase in approved private storage. Keep seven daily versions and four weekly versions. Keep the decryption/recovery key separate from backups and repository.
4. Implement an isolated restore script: build migrations, restore application data, recreate/reinvite auth users where auth restoration is not included, reconcile old user IDs to new IDs through the identity mapping, and verify role/access/history. Deactivated users must stay deactivated. Sending starts disabled.
5. Document whether the chosen provider backup includes auth data/configuration. Follow supported restore guidance; do not assume CLI dumps automatically recover platform configuration or encrypted Vault keys. [Supabase backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
6. Run the restore drill before live activation and monthly afterward. Compare row counts, sample dates/meetings, history, membership roles, message ledger, and access denial. Reconcile any provider sends since the backup before enabling reminders.
7. If the office cannot maintain this backup routine, the free-tier production gate is unmet; present paid managed backups or an approved automated runner for a decision.

### Monitoring

1. Expose a protected health response with last worker heartbeat and expected daily-run state; return no task content. Healthy means recent heartbeat and no overdue unprocessed send state, not merely an HTTP 200 webpage.
2. Configure an independent owner-approved external monitor to check it every five minutes and notify the owner by email if heartbeat is older than five minutes or a daily run remains missed/failed/unknown after 09:30. The monitor must run outside Supabase so it can detect a paused database.
3. Select the monitor and verify its current free quota during setup; record provider, owner email, check interval, and any cost. Test an outage. No monitor account is assumed to exist.
4. Keep in-app operational banners as the staff-facing secondary signal. A read receipt is optional and must not be necessary for success; Delivered is the desired provider status.

### Incident actions

| Symptom | Operator action |
|---|---|
| No reminder by 09:30 | Check Reminders/heartbeat, provider and Supabase status; use reviewed manual message after checking for Unknown attempts |
| Unknown delivery | Inspect correlated callback/Twilio SID or provider logs; do not repeatedly click Send; owner records resolution |
| Template rejected/disabled | Disable affected sending, show approved fallback if available, resubmit template; never fall back to unapproved free text |
| Wrong recipient | Disable sends immediately, correct verified recipient, inspect audit; do not resend until test is complete |
| Wrong meeting date | Edit with reason; review old send; manually issue correction if needed |
| Supabase paused | Restore service through provider UI, inspect missed-run cutoff, handle late reminders manually, reassess plan |
| Bad frontend deployment | Roll back Vercel to last known-good deployment; database remains intact |
| Bad migration | Stop affected writes/sends; use a reviewed forward repair or isolated restore; no blind production reset |

Exit: named operator, functioning independent alert, verified encrypted backup, successful restore, and documented emergency controls.

## 12. Stage J — release and handover

- Run every PRD acceptance scenario with saved evidence; include tests against real local Postgres and actual staging email/WhatsApp.
- Run typecheck, lint, unit/integration/browser tests and production build once against final code; rerun affected checks if changes follow.
- Test at representative data volume and mobile width. Inspect absence of secrets from Git, logs and client bundle.
- Record current pricing/quotas and costs in `docs/COSTS.md`; record external launch gates with evidence, not guessed completion.
- Run the seven-day owner-recipient pilot. Validate a Sunday reminder for a Monday meeting calculated from a weekend request.
- Demonstrate to staff: add task, enter After 10 days, add follow-up, revise date, add consenting contacts, select task/meeting/department recipients, report completion, send a multi-recipient supplemental reminder, inspect partial delivery failure, record opt-out.
- Demonstrate to owner: confirm completion, deactivate account, manage all-office subscriptions, disable automatic sending, export, restore and investigate Unknown delivery for one contact without resending to others.
- Deliver README setup commands, environment inventory, schema diagram, generated types, migration history, test results, cost sheet, runbook and BUILD-STATUS.
- Owner authorises the production-recipient test; verify delivery; owner enables the scheduled live digest. Record the activation time and first expected reminder date.

## 13. Instructions for AI assistants resuming work

Read PRD → this guide → BUILD-STATUS → DECISIONS. Inspect actual code and environment before assuming a stage is complete. Continue the first unfinished stage. Implement production behaviour and its meaningful tests, not UI mockups presented as completion. Use the user's most recent corrections as authoritative and update the written requirements accordingly.

You can build and test locally while cloud accounts are pending. Ask the owner only for external facts/actions that cannot be discovered: authorised emails, office departments, account verification, data-hosting approval, actual recipient consent, paid plan choices, and real send approval. Do not ask them to choose framework internals or debug SQL. Report remaining dependencies candidly.
