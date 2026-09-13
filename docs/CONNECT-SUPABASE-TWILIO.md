# Connect the working local build to Supabase and Twilio

This guide applies to the code in this folder, not to a hypothetical scaffold. The application runs locally now. Hosted login, email and WhatsApp still need your own accounts and verification.

## 1. Try the local tracker first

1. Install Node.js 24 LTS.
2. Open a terminal in this project and run `npm ci`.
3. Copy `.env.example` to `.env.local`. Keep APP_MODE=demo and APP_ENV=local.
4. Run `npm run dev`, then open http://localhost:3000.
5. Create an instruction and choose After a number of days. Add a meeting, then add a person and a reminder subscription.
6. Open Reminders, choose a due date, and use Record test reminder. This writes a mock message to the local database; it cannot call Twilio.

Local preview uses actual embedded PostgreSQL with the same migrations and protected commands as the connected app. It runs as a synthetic owner on this computer. Records are stored in `.local/postgres`, excluded from Git. The first load can take several seconds while PostgreSQL starts. Subsequent requests are much faster. The preview is not a multi-user hosted system.

## 2. Create Supabase staging

1. Create a Supabase organisation/project named `acs-g-tracker-staging`. Use the free tier while testing, within its limits. Choose an office-approved region.
2. Keep your database password and privileged key in your password manager, not chat or GitHub.
3. Install/login with the Supabase CLI: `npx supabase login`.
4. Find the project reference in Supabase settings and run `npx supabase link --project-ref YOUR_PROJECT_REFERENCE`. Confirm this is staging, not production.
5. Run `npx supabase db push`. Review the SQL first. This applies the ordered migration files in `supabase/migrations`.
6. Do not run `db reset` against a hosted project. The existing `.local` preview data is deliberately not imported.

Alternatively, run the migration files in Supabase SQL Editor in filename order, exactly once per fresh project. The CLI path is preferable because it tracks applied migrations. Do not apply both methods to the same fresh project without reconciling migration history.

## 3. Connect the app

Edit your private `.env.local`:

```dotenv
APP_MODE=connected
APP_ENV=staging
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REFERENCE.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_ADMIN_KEY=YOUR_SERVER_SECRET_OR_LEGACY_SERVICE_ROLE_KEY
```

These are placeholders for values entered locally. Only the URL and publishable key belong in NEXT_PUBLIC variables. Restart the dev server after changing them. Nothing in the browser may contain the admin key.

## 4. Create your owner account

1. In Supabase Authentication settings, turn off public signup.
2. In Authentication → Users, create your own email/password account using the provider's supported admin flow.
3. Temporarily add OWNER_EMAIL and OWNER_NAME to your private `.env.local`.
4. Run `node --env-file=.env.local scripts/bootstrap-owner.mjs`.
5. The script refuses to overwrite an existing active owner. It attaches the owner role to the exact existing auth account, without creating a publicly accessible owner-registration endpoint.
6. Sign in to the app. Add actual departments in Settings. The connected database starts empty.

To deactivate an account before the member-management UI is added, the infrastructure owner can set its `memberships.active` field to false in the Supabase Table Editor. Do not disable the last owner. App requests check active membership, so the user loses application access even with an existing auth session.

## 5. Set up invitations and password recovery

1. Configure authorised transactional SMTP in Supabase Authentication → SMTP. Do not rely on the default mail service for production staff invitations.
2. Set the Site URL to your app's current origin; add exact permitted callback URLs. For local staging include `http://localhost:3000/auth/callback`.
3. Configure invite email links to use the token-hash callback:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/reset-password">Set your password</a>
```

4. Configure recovery email links similarly, using type=recovery:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset your password</a>
```

5. In app Settings, use Invite office staff. Editors can change instructions and meetings; viewers are read-only.
6. Test invitation and recovery with an email you control. Confirm the right role and correct staging URL. A failure after the invite is sent but before membership creation leaves the account without workspace access; repair its membership through the trusted administration interface rather than enabling public signup.

## 6. Twilio setup

Choose Code, JavaScript/Node.js, WhatsApp, and Notifications/reminders during onboarding.

1. Start with Twilio's WhatsApp Sandbox and join it using your own phone. Do not use ACS(G)'s number for the first test.
2. Confirm Twilio will onboard the office's government use case for production. Follow its business/sender verification steps.
3. For the sandbox, use a compatible pre-approved template. Production needs an approved custom template; do not assume sandbox free-form sending works outside a valid conversation window.
4. The current worker expects one approved template with these variables:

| Variable | Value supplied by the worker |
|---|---|
| 1 | Due date in YYYY-MM-DD |
| 2 | Single-line summary of up to five events, capped at 700 characters |
| 3 | Total number of relevant events |
| 4 | Your authenticated tracker URL |

Suggested submission text (provider approval is required):

> ACS(G) Office reminder for {{1}}. Items for follow-up: {{2}}. Total items: {{3}}. Please coordinate the update or meeting with the office. Authorised staff can view the full agenda at {{4}}.

The current template adapter is an initial integration. Before production, validate actual template/category approval, total length, readable summaries for long records, and the PRD's full template variants and overflow behaviour. A person without an app account cannot open the private agenda. Do not make the link public to avoid login.

## 7. Deploy Edge Functions

From the linked staging project:

```powershell
npx supabase functions deploy reminder-dispatch
npx supabase functions deploy whatsapp-status
```

The checked-in config disables gateway JWT verification only for these two functions. The dispatcher requires its separate cron secret; the callback requires a valid Twilio signature. Never remove those checks.

Set these secrets in Supabase Functions settings or through the supported secrets UI:

| Secret | Initial value / purpose |
|---|---|
| APP_ENV | staging |
| APP_BASE_URL | Your app's actual URL |
| MESSAGING_MODE | test, after mock checks pass |
| WHATSAPP_SEND_ENABLED | false initially; true only for an authorised test |
| REMINDER_CRON_SECRET | Generate a long random secret |
| TEST_RECIPIENT_ALLOWLIST | Comma-separated international test numbers you control |
| TWILIO_ACCOUNT_SID | From Twilio account settings |
| TWILIO_AUTH_TOKEN | Private account token |
| TWILIO_WHATSAPP_FROM | whatsapp: followed by approved sandbox/sender number |
| TWILIO_DIGEST_CONTENT_SID | Approved template identifier beginning HX |
| TWILIO_DIGEST_CONTENT_VARIABLES | Optional JSON object for template variables; use `none` for a static template |
| WORKER_ADMIN_KEY | Privileged Supabase key if the legacy auto-provided service-role variable is unavailable |

Twilio must be able to reach the deployed HTTPS callback. The worker passes a message-specific callback URL automatically. Callback signature checks use the exact canonical Supabase URL.

The verified static template `HX8dc9eea84231541b091557c47cc2a342` proves sender connectivity only; it cannot display the reminder selected in the frontend because it has no dynamic variables. For the application reminder flow, use an approved template containing `{{1}}` through `{{4}}`, keep `TWILIO_DIGEST_CONTENT_VARIABLES` unset (the worker supplies the due date, frontend-generated summary, item count, and agenda URL), and set `TWILIO_WHATSAPP_FROM=whatsapp:+17372508034`. Put the controlled recipient number in `TEST_RECIPIENT_ALLOWLIST`. Do not put the Twilio auth token in this repository or in the browser.

## 8. Enable a controlled reminder test

1. Record a consenting test contact in People; subscribe it to a task, meeting or department. Only the owner can subscribe someone to all office items.
2. In Supabase SQL Editor, change `app_settings.messaging_mode` from mock to test. Keep automatic_enabled=false for the first manual test.
3. Set the Edge secret WHATSAPP_SEND_ENABLED=true only after the owner-controlled number and approved template are ready.
4. Preview an eligible event in the app and click Send reminder now. This creates a queued outbox record; it does not call Twilio directly from the browser.
5. Invoke the dispatcher using its cron secret, or enable the cron job below. Inspect the message record and Twilio logs. Accepted is not Delivered. Verify the real phone receives it.
6. The worker sends only allowlisted numbers in test mode. Unknown network outcomes are not automatically resent. Inspect Twilio before any retry.
7. The initial worker marks definite errors for operator review; the PRD's bounded automatic retry/reconciliation dashboard remains unfinished. Do not claim production delivery guarantees from a successful one-off test.

## 9. Schedule daily reminders

1. In Supabase Vault add `project_url` (the Supabase project URL) and `reminder_cron_secret` (matching the dispatcher secret).
2. Review and execute `supabase/setup-cron.sql` once. It replaces the single named cron job, so repeating setup does not multiply jobs.
3. The worker is called every minute. Business logic prepares the daily digest at 9 AM Asia/Karachi; only items due the following day qualify. Weekend meetings already have Monday effective dates.
4. Enable `app_settings.automatic_enabled` only after the manual test passes. Keep test mode and the test allowlist throughout the pilot.
5. At 09:30, a delayed unsent daily batch requires manual handling. Do not replay old daily digests after an outage.
6. Supabase Free can pause; a cron job is not a promise of uninterrupted operation. Set up independent monitoring and backups before relying on it.

## 10. GitHub and Vercel

1. Create a private GitHub repository under your account. Upload or push this project, excluding `.env.local`, `.local`, `.next` and all node_modules folders. `.gitignore` covers these.
2. The included GitHub Actions workflow runs lint, type checking, PostgreSQL/unit tests and a production build using Node 24.
3. Import the repository into Vercel. Confirm whether your office use qualifies for Hobby; otherwise obtain an approved hosting/budget decision.
4. Vercel Preview variables must point to staging Supabase. Production variables must point to a separate production project. Set APP_MODE=connected and the correct APP_ENV/APP_BASE_URL. Never deploy local-preview data.
5. Update Supabase Site URL, redirect URLs and the worker's APP_BASE_URL to the deployed origin. Configure production SMTP separately.
6. Repeat actual account and message tests. Keep live automatic messages disabled until the production checklist in BUILD-STATUS is resolved.

## 11. Where the code is

- `src/components/tracker.tsx`: staff interface and forms.
- `src/lib/domain.ts`: date previews, recipient grouping and shared types.
- `src/lib/local-db.ts`: loopback-only embedded PostgreSQL preview and synthetic seed records.
- `src/app/api`: user-scoped reads/commands, login, invitation, reminder previews and enqueue.
- `supabase/migrations`: authoritative database constraints, permissions, mutations and reminder queue.
- `supabase/functions`: guarded dispatcher and signature-checked delivery callback.
- `tests`: core rules, database permissions/queue and browser workflow.

This is a working first local build and integration foundation, not a completed production release. BUILD-STATUS lists the unimplemented PRD requirements explicitly.
