# Start here — prompt for the AI coding assistant

Copy the following prompt into the project task after providing this documentation folder:

> Continue the ACS(G) Instructions and Meeting Tracker in this existing `acs-g-tracker` folder. Read `docs/BUILD-STATUS.md`, `docs/01-PRODUCT-REQUIREMENTS.md`, `docs/02-BUILD-AND-OPERATIONS-GUIDE.md` and `docs/DECISIONS.md` before editing code. Do not scaffold a second or nested project; do not alter the existing Monday Ledger or import office data automatically.
>
> Follow the guide in stages. Implement real Supabase persistence, database-enforced roles, authoritative date calculations, multiple task meetings, reliable WhatsApp outbox/callback handling, and a mobile-friendly interface. Staff can add tasks and directly change dates with history; only the owner confirms task completion. Staff can add any number of consenting recipient contacts and subscribe them to tasks, meetings or departments. ACS(G) has an owner-managed all-office subscription. All weekend meetings move to Monday and are reminded Sunday at 9 AM Pakistan time; task deadlines do not shift. Daily reminders are one combined message per recipient for tomorrow's relevant events, with deduplication and independent delivery tracking. Late additions use a previewed Send reminder now action.
>
> Start locally in mock messaging mode. Never send to ACS(G), buy subscriptions, or enable production automatic messaging without the required owner action. Never ask me to paste secrets into chat. Explain exactly which provider setting I need to fill when a human account step is necessary. Keep development moving with mock services while account verification is pending.
>
> Use the PRD's explicit defaults; do not add n8n, AI parsing, WhatsApp groups, calendar booking, or mandatory paid services. Department-scoped individual reminders are included. Check current provider documentation before integration. Report Vercel eligibility, SMTP, WhatsApp onboarding/templates, backups and monitoring as launch gates until verified. Do not claim unlimited provider sending capacity or unchanged costs as recipient count grows.
>
> Update the existing `docs/BUILD-STATUS.md`, record selected versions and decisions, and complete one stage with its exit checks at a time. Test permissions through direct database/API calls, date boundaries, concurrency, ambiguous provider delivery, retries, and restore. Do not claim production readiness from a mock/demo. At each checkpoint report what works, what was tested, what still needs my external input, and the next stage.

## Current status

- A working first local build exists. Read BUILD-STATUS.md for verified features, test results and the remaining production gaps.
- Domain rules, SQL migrations/RLS, staff interface, recipient management, mock reminders, Supabase routes and guarded Twilio worker code are implemented.
- Do not scaffold again or reimplement throwing stubs; that earlier stopping point is obsolete.
- No cloud accounts or real messages have been configured. Keep sending disabled while connecting staging and completing production acceptance.
- Owner preference remains minimal subscription cost, with free tiers where permitted and small usage charges acceptable.
- Source of truth: PRD v1.1, the code, BUILD-STATUS and subsequent user corrections.

## Files

1. `01-PRODUCT-REQUIREMENTS.md` — behaviour, roles, dates, data model, APIs, reminders, acceptance and release rules.
2. `02-BUILD-AND-OPERATIONS-GUIDE.md` — local setup, Supabase, Auth/SMTP, Twilio, scheduling, Vercel, backups, monitoring and launch.
3. `03-AI-HANDOFF.md` — this reusable starting prompt.

