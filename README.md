# ACS(G) Office Workspace

A private instructions, meetings and WhatsApp reminder tracker. The first local build is usable; hosted services and the remaining production gates are not yet configured.

## Run locally

Use Node.js 24 LTS.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. Existing local setup already includes `.env.local`; do not overwrite a file containing your configured credentials.

Local preview uses synthetic records and PostgreSQL stored in `.local/postgres`. It does not send WhatsApp or emails. Keep `.local` and `.env.local` out of GitHub.

## Current features

- Instructions, departments, progress updates and owner-confirmed completion.
- Explicit dates or relative calendar-day timelines.
- Multiple meetings and follow-ups; weekend meetings roll forward to Monday.
- Consenting contacts with task, meeting, department or owner-managed office-wide subscriptions.
- Database-generated reminder previews, mock/queued outbox, duplicate suppression and per-person status history.
- Supabase login/recovery/invitation routes, RLS, server-side commands and version conflicts.
- Guarded Twilio worker/callback integration files; sending disabled by default.
- Responsive desktop/mobile interface and CSV export.

## Verify

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Browser test, while the dev server runs: `npm run test:e2e`. The local configuration uses installed Microsoft Edge; adjust the Playwright channel or install Chromium for another machine. Database tests use real PostgreSQL semantics through PGlite with a simulated Supabase auth identity; they do not prove hosted Auth, SMTP, Cron or Twilio delivery.

## Continue / connect

1. [Current build status](docs/BUILD-STATUS.md)
2. [Connect Supabase and Twilio](docs/CONNECT-SUPABASE-TWILIO.md)
3. [Product requirements v1.1](docs/01-PRODUCT-REQUIREMENTS.md)
4. [Full production build guide](docs/02-BUILD-AND-OPERATIONS-GUIDE.md)
5. [AI handoff](docs/03-AI-HANDOFF.md)

Never switch to real-recipient sending just to test whether credentials work. Use an owner-controlled allowlisted phone first. No GitHub remote or live deployment has been created by this build.
