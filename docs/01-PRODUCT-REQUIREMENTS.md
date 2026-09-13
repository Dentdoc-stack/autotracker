# ACS(G) Instructions and Meeting Tracker — Production PRD

Version 1.1 · Prepared 12 September 2026 · Updated to support team-managed multiple recipients. Status: ready for implementation against the defaults below; external launch gates remain open.

Read this file first, then `02-BUILD-AND-OPERATIONS-GUIDE.md`. Give a new AI coding assistant `03-AI-HANDOFF.md`. These documents specify a product; no application, accounts, migrations, messages, or deployments have been created by preparing them.

## 1. Product outcome

Provide a private, mobile-friendly tracker where authorised staff record ACS(G)'s instructions, responsible departments, deadlines, and meetings. ACS(G) and additional people added by the team receive individual consolidated WhatsApp reminders at 9 AM Pakistan time for tomorrow's relevant deadlines and meetings, allowing the office to request updates and arrange meetings. Each person receives only the events covered by their reminder subscriptions.

The application must work when nobody has a browser open. Dates, permissions, and reminders must be enforced on the server and database, not just in the interface.

### Success criteria

- Staff can record an instruction and its first deadline or meeting in under two minutes during usability testing.
- Entering 12 September 2026 plus 10 calendar days produces 22 September and a 21 September reminder.
- Every meeting calculated for Saturday or Sunday moves to Monday; its reminder is Sunday at 9 AM.
- Staff can change dates without owner approval, with a recorded reason and history.
- Staff report task completion; only the owner confirms completion.
- Under normal service availability, the daily digest is submitted to WhatsApp by 9:05 AM. Delivery to the phone is monitored but cannot be guaranteed at an exact time.
- Duplicate scheduler invocations, repeated clicks, and callback replays do not create duplicate logical sends.
- Uncertain delivery is visible and is never silently labelled delivered.
- Application use is private and invite-only. A link alone never grants access to task information.

## 2. Confirmed decisions and explicit defaults

| Topic | Requirement | Basis |
|---|---|---|
| Recipients | ACS(G) plus any number of consenting contacts added by authorised team members; one combined message per recipient | Confirmed expansion; subscription scopes below are explicit defaults |
| Editors | Owner, selected staff, and invited related people can add tasks and directly edit timelines | Confirmed; related people must be authorised |
| Reminder | One combined message per person at 9 AM Asia/Karachi for tomorrow's relevant items | Confirmed |
| Relative dates | Add the entered number of calendar days to the selected base date; day zero is the base date | Confirmed example |
| Late additions/changes | Show Send reminder now; do not automatically send an extra message | Confirmed |
| Meetings | Initial, review, and follow-up meetings; all weekend meetings roll forward to Monday | Confirmed |
| Task deadlines | Keep the entered date even on weekends | Established in workflow |
| Completion | Staff report complete; owner confirms or returns for more work | Confirmed |
| Architecture | Custom application, Supabase, Twilio; no n8n | Accepted direction |
| Budget | Free tiers where eligible; small usage charges acceptable | Confirmed; not permission to buy a subscription |
| Calendar | Pakistan time; no automatic public-holiday adjustment | Version 1 default |
| Language | English interface and message templates; Unicode names/notes supported | Version 1 default |
| Access scope | All invited editors can read/edit all office tasks; no department isolation in version 1 | Explicit small-office default |
| Meeting booking | Proposed/confirmed meeting records; no calendar invitations or automatic booking | Version 1 default |
| Overdue reminders | Visible in tracker; no automatic repeated overdue WhatsApp messages | Version 1 default |

An implementer must preserve confirmed decisions. If the owner requests department-specific confidentiality, revise the access model before inviting those users; do not imply that a department field restricts access.

## 3. Scope

### Version 1 must include

1. Invite-only email/password login, account recovery, owner/editor/viewer roles, immediate app access revocation.
2. Departments, task creation/editing, progress notes, task deadlines, multiple linked meetings, date history.
3. Owner confirmation of completion, meeting outcomes, next follow-up creation.
4. Dashboard, filterable task list, meeting agenda, task detail, message preview/history, owner settings.
5. Scheduled daily digest, manual supplemental reminder, delivery callbacks, retry and uncertainty handling.
6. Audit trail, optimistic edit conflict handling, CSV export, backups and restore instructions.
7. Mock messaging for development, test-recipient mode for staging, isolated production configuration.

### Excluded from version 1

- WhatsApp replies changing tasks, WhatsApp groups, AI interpretation of unstructured instructions. Department-scoped individual reminders are included through contact subscriptions.
- OneNote/Excel automatic import, n8n, voice transcription, automatic public-holiday calendars.
- Calendar booking, attendance confirmation from ACS(G), recurring meetings generated indefinitely.
- Native mobile apps, file attachments, multi-organisation tenancy, analytics beyond operational counts.

Existing Monday Ledger and directive spreadsheets are reference material only. Do not import their content or modify them automatically. Manual entry is the initial migration path; a later import must show a review preview and duplicate handling.

## 4. People and permissions

| Action | Owner | Editor / invited related person | Viewer, including optional ACS(G) login |
|---|---|---|---|
| View tasks, notes, meetings, dates | Yes | Yes | Yes |
| Create/edit tasks, deadlines, meetings | Yes | Yes | No |
| Add progress, record meeting outcome | Yes | Yes | No |
| Report task complete | Yes | Yes | No |
| Confirm completion, return, reopen | Yes | No | No |
| Preview/send supplemental reminder | Yes | Yes | No |
| View operational delivery status | Yes | Yes | No |
| Cancel meetings | Yes | Yes, reason required | No |
| Cancel/archive tasks | Yes | No | No |
| Export task/meeting CSV | Yes | Yes | No |
| Add/edit contacts and task/meeting/department reminder subscriptions | Yes | Yes | No |
| Manage all-office digest subscribers, accounts, departments, templates, global send switch | Yes | No | No |
| Review full audit history | Yes | Task-specific history only | No |

There is exactly one active owner initially. Owner transfer is a documented maintenance operation, not an open registration option. Do not allow disabling the last owner. Authenticated users without an active membership have no data access, even if they have a valid Supabase session. Regular staff are app users, not Supabase/Vercel administrators.

### 4.1 Recipient directory and subscriptions

Editors and the owner can add contacts: name, WhatsApp number, optional designation/department, enabled state, and consent evidence/time. Normalise to E.164 and enforce one contact per phone number. Adding a contact is not the same as granting app access; contacts do not need login accounts. Related people who need to manage the tracker must separately be invited as editors.

When adding a contact, select the reminders they should receive: this task, this meeting, or this department. A task subscription includes its deadline and all active linked meetings, including future follow-ups. A meeting subscription covers only that meeting. A department subscription covers tasks linked to that department, including their meetings. Only the owner can add an all-office subscription; ACS(G) receives that scope by default. These scopes control WhatsApp disclosure, not the separate app access model.

There is no hardcoded product limit on contact count. Provider throughput, verified sending limits, quotas and budget remain real constraints. Never describe delivery capacity as unlimited. List contacts with pagination and show the resolved recipient list and message count in previews.

Resolve overlapping subscriptions by contact: task + meeting + department still produces one event entry in one daily digest for that phone number. Recipients receive individual messages, never a WhatsApp group broadcast. Recipient-specific agenda links require login and the viewer's authorised app access; recipients without app accounts receive the WhatsApp summary and can contact the office for remaining details. Do not create public token links as a shortcut.

Require consent before enabling delivery. A reported opt-out suppresses that contact immediately across all subscriptions, queued sends and retries. Editors can record opt-out and manage subscriptions without owner approval; re-enabling requires new recorded consent. A number change resets verification/consent for the new number and cancels unsent deliveries to the old number. All contact/subscription changes are audited. Editors can see phone numbers in the contact manager for authorised maintenance; general task/message lists mask them.

A contact/subscription added after the 09:00 cutoff receives no automatic catch-up that day; show Send reminder now. Before each submission recheck the contact is enabled, opted in, and still subscribed. Removing a subscription cannot retract an already delivered reminder. Keep snapshots for audit; changes must never cause a second automatic digest that day to an already processed contact.

## 5. Product workflow

### 5.1 Record an instruction

Required: title (1–160 characters), instruction text (1–5,000), primary department, instruction date. Optional: additional linked departments, responsible person's name/designation (up to 200), source/meeting reference (up to 500), initial note (up to 2,000).

Choose any combination of:

- Task deadline: completion due or update due. Enter a specific date or After N days with a visible base date, defaulting to instruction date.
- Meeting: initial, review, or follow-up. Enter a specific date or After N days with an explicit base date.
- No date yet: save the task with a visible Unscheduled label and no automatic reminders.

The form displays the computed deadline, any weekend meeting adjustment, and each reminder date before saving. It never interprets vague text such as soon or next week as a deadline. Relative-day input is an integer from 0 to 3,650; invalid values are rejected. A past date is allowed for recording existing instructions, but requires acknowledging a visible past-date notice; it does not trigger an immediate automated message.

The server calculates and returns authoritative dates. A browser preview is convenience only. A single save creates the task and any initial meeting atomically, or none of them.

### 5.2 Track progress and dates

Task status: Open → In progress → Reported complete → Completed. Owner may return Reported complete to In progress with a reason, or reopen Completed to In progress with a reason. Owner can cancel a task. Open and In progress may transition between each other with a progress note. Editors cannot edit a completed/cancelled task until the owner reopens it.

Reported complete requires a completion note. Until confirmation, the task deadline remains reminder-eligible, explicitly labelled completion awaiting confirmation. Overdue is a computed indicator, not a stored status. A deadline becomes overdue at the start of the following local calendar day. An update-due task can remain open after a progress report; staff must explicitly set its next date or clear the fulfilled date, with a reason.

All timeline changes require a reason, retain previous values, and increment the relevant reminder revision. Editing instruction date alone never silently recalculates existing deadlines or meetings. Recalculation is an explicit timeline edit with preview. Notes do not themselves increment reminder revision.

### 5.3 Meetings and follow-ups

Each task can have multiple meeting records. A meeting has a title, type, requested date, effective date, optional local time, optional venue/link, and state Proposed, Confirmed, Held, or Cancelled. A proposed meeting appears in reminders as Arrange meeting; a confirmed meeting appears as Meeting scheduled. A time is not required; date-only meetings show Time to be arranged.

Every Saturday requested date adds two days; every Sunday adds one. Weekdays are unchanged. The original requested date is preserved, and the effective date drives reminders, agenda sorting, and overdue display. Times remain the same local wall-clock time after shifting the date. Public holidays do not shift dates in version 1.

Staff can record an outcome when marking Held, then select Add follow-up after N days. Its base date defaults to the recorded actual meeting date, not the date the user is typing the notes. If no actual date has been recorded, require selecting one. The next follow-up is a new record linked to the previous meeting; do not overwrite meeting history. There is no automatic repeat interval.

Completing a task suppresses its task deadline, but does not silently cancel an already arranged meeting. The confirmation screen lists outstanding meetings and lets the owner explicitly keep or cancel them; default is keep. Cancelling a task atomically cancels outstanding meetings, with one recorded reason. Marking Held/Cancelled suppresses that meeting's future reminders.

### 5.4 Daily reminder

At 9 AM Asia/Karachi, gather active task deadlines and Proposed/Confirmed meetings whose effective date is tomorrow. Exclude completed/cancelled task deadlines and held/cancelled meetings. Include no unscheduled items and no older overdue items.

For each eligible contact, resolve subscriptions and group by task so a task deadline and meeting on the same date are presented together. Preserve every underlying event in the digest record. Sort by primary department name, then task reference. Send one digest per contact if at least one relevant eligible event exists. If empty for a contact, send nothing to that contact. If empty overall, record No items due. ACS(G)'s all-office digest and department-specific digests will intentionally contain different items.

A Sunday digest includes all Monday meetings, including those moved from Saturday/Sunday, and any Monday task deadlines. Saturday task deadlines remain Saturday and are reminded Friday. Reminders are date-based even if a meeting has a time.

### 5.5 Late entries and changed dates

An event whose scheduled reminder time has passed and whose current revision has not been notified displays Reminder not sent — Send reminder now. Adding such an event does not trigger automatic sending. Staff sees the exact message preview and must click Send once.

If a deadline or meeting is changed/cancelled after a reminder was already sent, show a separate Earlier reminder may be outdated warning with a manually sent correction option. A cancellation correction is allowed even though the event is no longer reminder-eligible. Display both old and new dates for a change, and cancelled for a cancellation.

The standard button will not resend a current revision already accepted by the provider. An unresolved send shows Check delivery rather than Send again. After an owner verifies delivery evidence and records a reason, an explicit resend is possible. It creates a new audited attempt and states that a duplicate may reach the recipient.

Manual sending does not alter the event date. If a future event is manually reminded before its normal day-before schedule, its normal daily reminder still occurs. Manual late reminders and daily reminders for the same event/revision/due-date occurrence share suppression checks.

## 6. Date examples — mandatory regression fixtures

All examples use 2026 and Asia/Karachi.

| Input | Stored result | Reminder |
|---|---|---|
| Task deadline: 12 Sep + 10 days | 22 Sep, Tuesday | 21 Sep, 9 AM |
| Follow-up: actual meeting 22 Sep + 4 days | Requested 26 Sep Saturday; effective 28 Sep Monday | 27 Sep Sunday, 9 AM |
| Meeting requested 27 Sep Sunday | Effective 28 Sep Monday | 27 Sep Sunday, 9 AM |
| Meeting requested 25 Sep Friday | Effective 25 Sep Friday | 24 Sep Thursday, 9 AM |
| Task deadline 26 Sep Saturday | Still 26 Sep Saturday | 25 Sep Friday, 9 AM |
| Meeting requested 12 Sep Saturday | Effective 14 Sep Monday | 13 Sep Sunday, 9 AM |
| 28 Dec + 10 calendar days | 7 Jan 2027 | 6 Jan 2027, 9 AM |

Use SQL DATE for business dates and TIMESTAMPTZ for actual instants. The browser's timezone must not change results. Store the relative base date and day count when used, but store calculated dates as well. Meeting reminder dates always derive from effective dates. Use the IANA timezone identifier, not a hardcoded browser offset.

## 7. Screens and interface acceptance

### Dashboard

Cards for open tasks, tomorrow's deadlines/meetings, overdue items, and completion awaiting confirmation. Show next digest date/time and most recent digest state. Link to failures/missed reminders. Counts respect task/meeting distinctions and never count duplicate joined rows.

### Tasks

Search title, reference, instruction, responsible person. Filter by primary/linked department, task status, due-date range, deadline kind, and unscheduled. Paginate 25 rows by default. Columns: reference, instruction/title, department, responsible person, deadline, status, next meeting. Clicking a row opens task details.

### Task detail

Show full instruction, source, dates, latest updates, full progress history, meetings, completion actions, and timeline history. Show old/new values and actor for date changes. Add meeting and Add follow-up are prominent. Show a save-conflict notice when another user edited the record.

### Meetings

Default agenda list with date-range, department, and state filters. Show requested/effective date together when adjusted, proposed/confirmed distinction, time/venue, and associated task. Provide a simple month view if it does not delay the agenda; the agenda is the required release view.

### Reminders

Editors can view tomorrow's draft and manually send eligible late/correction items. History shows Scheduled/Queued/Accepted/Sent/Delivered/Read/Failed/Unknown/Skipped as applicable, local timestamps, included item count, and safe error explanation. Accepted is not Delivered. Owner can investigate unknown sends. A live draft must be labelled Preview; sent messages are immutable snapshots.

### Settings

Owner manages accounts, departments, all-office subscribers, active template mapping, messaging mode, and automatic-send switch. Editors and owner manage contacts, opt-in and task/meeting/department subscriptions in a Contacts screen and embedded recipient selectors. Adding an enabled consenting contact does not require owner approval. Secrets are not displayed in the app; they belong in platform secret settings. A changed phone number requires fresh verification/consent before that contact resumes delivery; other contacts are unaffected. Inactive departments remain on historic records but cannot be chosen for new records.

### General

Responsive at 360px width; keyboard-accessible forms; visible focus; labelled inputs; status meaning not conveyed by colour alone. Display dates as 22 Sep 2026, not ambiguous numeric dates. Loading, empty, failure, retry, and denied-access states are required. Warn before navigating away from unsaved edits. No public task pages, no message credentials, and no implementation jargon in normal staff screens.

## 8. Technical architecture and interfaces

Default stack: Next.js App Router + TypeScript + Tailwind on Vercel; Supabase Postgres/Auth/Cron/Edge Functions; Twilio WhatsApp. Use stable compatible versions available when implementation starts, pin them in the lockfile, and record the versions in the project README. Do not add n8n, Redis, AI services, or an extra queue vendor.

Flow: browser → authenticated Next.js route → user-scoped Supabase RPC → Postgres. Cron → authenticated reminder Edge Function → outbox → Twilio. Twilio → signature-verified callback Edge Function → delivery event record. All status checks shown in the UI come from persisted database records.

Normal browser/server user operations use the caller's Supabase access token and publishable key. Privileged credentials are reserved for account invitation and isolated worker operations. Enforce active membership, role, constraints, and status transitions in database functions as well as application handlers. Do not make normal CRUD depend on unrestricted service-role calls.

### Minimum data model

All entity identifiers are UUIDs, except human-readable task references generated by a database sequence (ACS-000001). Entity timestamps are TIMESTAMPTZ. Business dates are DATE. Actor references survive account deactivation. All normal tables have RLS enabled; private operational tables are not exposed through public anonymous access.

| Entity | Minimum fields / constraints |
|---|---|
| memberships | auth user ID unique, display name, role owner/editor/viewer, active; role cannot be self-assigned |
| departments | ID, unique case-insensitive name, active |
| tasks | ID, reference unique, title, instruction, primary department FK, responsible person, instruction date, source, status, optional deadline date and kind completion/update, optional relative base/days, reminder revision and revision timestamp, version, created/updated actor/time, completed actor/time, cancelled reason/time |
| task_departments | task ID + department ID unique; secondary departments only |
| task_updates | task ID, note, kind progress/completion_report/return/reopen, actor, created time; append-only |
| meetings | task FK, optional previous meeting FK from same task, type initial/review/followup, title, requested date, effective date, optional base/days, time, venue, state, actual date/outcome, reminder revision and revision timestamp, version, actors/times |
| audit_events | entity type/ID, action, actor or system, before/after JSON, reason, request ID, timestamp; append-only |
| contacts | ID, unique normalised E.164 phone, name, designation/department, enabled, consent evidence/time, opt-out time, verified time, version, actors/times; never exposed to anonymous/viewer clients |
| reminder_subscriptions | contact FK, scope office/department/task/meeting, scope target FK as appropriate, enabled, revision/time, actors; check exactly one matching target or none for office; unique contact/scope/target |
| app_settings | timezone fixed Asia/Karachi, 09:00 schedule, mode mock/test/live, automatic sends enabled, approved template mappings, schema version |
| daily_runs | local run date unique, cutoff timestamp, state, candidate and recipient counts, per-state delivery counts, run times/error, no-data reason; derive aggregate partial failure from recipient messages |
| notification_messages | ID, logical key unique, kind daily/manual/correction, recipient snapshot, mode, template ID, content snapshot/hash, state, provider SID unique nullable, attempt count, lease, next attempt, created/sent/delivered/error metadata |
| notification_items | message FK, entity type/ID, event revision, due date, label snapshot; unique message/entity/revision/event-kind |
| notification_occurrences | entity type/ID, revision, due date, stable contact ID, environment, phase early/normal/correction, owning message, claim state; unique occurrence key prevents competing messages from claiming the same event |
| manual_requests | ID, requester, user idempotency key unique per requester, preview hash, selected contact IDs and event revisions, counts/state, created time; parent of per-contact notification messages |
| notification_attempts | message FK, attempt number unique per message, request correlation, start/end, outcome, safe provider error, SID if known |
| provider_events | message FK when matched, SID, payload fingerprint unique, provider state, received time; immutable event history |
| operational_checks | worker heartbeat, last backup verification, last restore drill, last successful daily run; no secrets |

Index tasks by deadline/status and primary department; meetings by effective date/state; updates by task/time; messages by state/next_attempt and unique logical key; audit by entity/time. Use version-checked writes to reject stale changes with HTTP 409 rather than overwrite.

### Application contracts

Use JSON request bodies; Zod validates input; SQL validates again. IDs, actor, dates, roles, and statuses must not be trusted simply because a client submitted them. Successful mutation responses contain persisted entity/version/calculated dates. Error envelope: code, human-readable message, optional fieldErrors, requestId. Never include credentials or raw provider response dumps.

| Endpoint | Contract |
|---|---|
| GET /api/tasks | filters + cursor/limit; return tasks, next cursor, safe summary |
| POST /api/tasks | instruction fields + deadline input + optional initial meeting; return atomically created records |
| GET/PATCH /api/tasks/:id | read detail; edit requires expectedVersion and reason for timeline changes |
| POST /api/tasks/:id/updates | note + supported update action; server supplies actor/time |
| POST /api/tasks/:id/transition | action report_complete/confirm_complete/return/reopen/cancel; role checked; completion includes explicit outstanding-meeting choices |
| POST /api/tasks/:id/meetings | meeting input; optional previous meeting; computed date response |
| PATCH /api/meetings/:id | expectedVersion, fields/action, reason; Held requires outcome and actual date |
| GET /api/reminders/preview | daily draft or permitted manual/correction preview; no send side effect |
| POST /api/reminders/manual | event IDs/revisions, subscribed contact IDs, preview hash, idempotency key; return durable parent request ID, child message IDs and 202; stale preview returns 409 |
| GET /api/reminders | paginated safe history; no recipient secrets |
| GET/POST /api/contacts | editor/owner; paginated directory or validated contact creation with consent and initial subscriptions |
| PATCH /api/contacts/:id | editor/owner; expectedVersion, details/consent/opt-out; resets consent on phone change |
| POST/PATCH/DELETE /api/subscriptions[/:id] | editor/owner for task/meeting/department; office scope owner-only; audited changes and pre-send revalidation |
| POST /api/admin/invitations | owner only; email, display name, role editor/viewer; sends an explicitly requested invitation |
| PATCH /api/admin/members/:id | owner only; role/active; last owner protected |
| GET /api/export | editor/owner; task or meeting CSV; escape spreadsheet formula-leading cells |
| POST Edge reminder-dispatch | scheduler secret; no public/user trigger or arbitrary recipient allowed |
| POST Edge whatsapp-status | Twilio signature; URL/form payload validation; idempotent callback processing |

Date input shape: specific uses mode=specific and date=YYYY-MM-DD; relative uses mode=relative, baseDate=YYYY-MM-DD, days=integer. Reject mixed input modes. UI suggests base dates but server uses the explicitly submitted base. API callers cannot override effective meeting dates.

## 9. Reminder reliability contract

### Scheduler and snapshots

Use a Supabase Cron job every minute to invoke the worker. The worker records a heartbeat, processes explicitly requested manual messages, checks Pakistan time, and does no automatic digest work before 09:00. Exactly one daily run may be created per local date. A normal run targets tomorrow, using a fixed 09:00 local cutoff. If recovery happens on a later day, reconcile missing daily-run records since the last heartbeat as Missed without sending their digests.

If a short outage delays the first run, allow catch-up only through 09:30. Include only events whose current reminder revision existed by 09:00. Recheck current status and date before provider submission: remove completed/cancelled/moved events; do not add post-cutoff items to a delayed digest. Such items receive the manual-reminder flag. If no daily run starts by 09:30, mark that day Missed and require staff action. Do not automatically replay yesterday's digest.

Before sending, acquire a durable outbox lease and claim the event occurrences in a transaction so overlapping manual/daily workers cannot both claim them. Revalidate and freeze the content; an edit after submission may require a manual correction and cannot retract a sent message. Store exact included revisions and snapshot text.

Automatic logical key: stable contact ID + local reminder date + daily + environment. Contact version and phone are immutable message snapshots but not an excuse to send a second automatic digest on the same date. Manual keys include user idempotency key + contact ID and event/revision claims. Repeated manual clicks return the same per-contact messages. A manual button becomes temporarily disabled while its request is pending. Event occurrence uniqueness covers entity, revision, due date, contact ID, and environment for eligible late/manual versus daily sends.

Resolve and snapshot recipient eligibility at the same 09:00 cutoff as events. Persist one outbox message per eligible contact; process bounded batches with leases and at most five concurrent provider requests, reducing further if the account throughput requires it. Later worker ticks continue remaining batches. One contact's invalid number, failure or Unknown status must not block others or resend successful messages. Show partial success counts and per-recipient details. At 09:30 any still-unsent daily messages become missed/manual-action-required. Capacity test the configured recipient volume against this window before rollout; increase capacity through an explicit deployment decision rather than dropping recipients.

Manual preview lets staff select eligible subscribed contacts (default all affected contacts) and shows recipient count and each distinct message. The backend resolves subscriptions again and forbids arbitrary phone numbers in send requests. One manual action creates a parent request with idempotent child messages per contact; retries/resends target only selected failed or reconciled contacts. Persist manual request ID, requester, preview hash and counts for audit and rate limiting.

Occurrence phase is early for a manual reminder before its normal reminder day/time, normal for the daily digest or a late manual reminder, and correction for a previously sent date change/cancellation. Thus an early manual reminder does not suppress the later normal occurrence. Definitively rejected-before-acceptance or skipped-stale claims may be released transactionally; accepted or Unknown claims stay reserved until reconciliation. Owner-authorised resends explicitly reference the original message and create an audited override occurrence; never delete the original ledger to force a resend.

### Delivery lifecycle and retries

- Persist queued before the network call and an attempt record before submission.
- A provider SID means Accepted; later callbacks may mark Sent, Delivered, Read, Failed, or Undelivered. Store callback history and derive current state without regressing Read/Delivered on older events.
- When the provider explicitly rejects a request without creating a message and documents it as retryable (for example a rate limit), retry at 1, 5, and 15 minutes, respecting Retry-After if longer, with at most three retries. Retry only while content remains current and within the send window.
- An HTTP timeout, connection loss after possible transmission, worker crash during submission, or ambiguous server error can mean the provider accepted the message. Mark Unknown and do not blindly retry. Reconcile using a signed callback correlated to the message ID, or provider evidence inspected by the owner. Expired sending leases become Unknown, never automatically Queued.
- A definite delivery failure after SID acceptance is shown for manual resolution; do not automatically create a second provider message.
- No automatic attempts after 09:30 for the daily batch. Staff-triggered manual messages may be sent at any time after preview; staff controls their timing. Manual retries use the same bounded retry policy and stop 30 minutes after the request, then require review.
- A 09:30 missed/failed/unknown state creates an owner-visible operational alert. Independent monitoring must also notify the owner when the worker itself stops; an in-app banner alone is insufficient.

This provides durable duplicate prevention inside the application, not an impossible promise of exactly-once delivery across a third-party network. Unknown outcomes require reconciliation.

### Message size and template approval

Maintain one combined message per recipient, not one message per task. Format each task group as reference, short title, primary department, and deadline/meeting action. Use an office-branded greeting appropriate to the recipient, not wording addressed to ACS(G) on every contact's message. Do not include confidential long notes in WhatsApp by default.

Submit daily template variants for 1–5 task groups with fixed labels and separate, single-line variables. Each short title is at most 70 characters and department label at most 40. For more than five groups, use the five-group template, show total count and remaining count, and link to the full authenticated agenda. Never silently drop items: all are in the stored digest and full agenda. Final previews must use the provider-approved template length constraints; if any approved variant cannot fit, use an approved count-and-link summary template. This is an explicit single-message overflow default.

Manual/correction templates use the same one-message rule and distinguish Upcoming item, Date changed, and Cancelled. Include the applicable dates rather than claiming every manual item is tomorrow. Do not pass arbitrary multiline task lists as a template variable or assume a free-form message is allowed outside the customer-service window. Template approval and category are provider decisions, not guaranteed by this PRD. [Twilio template guidance](https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates), [variable guidance](https://www.twilio.com/docs/content/using-variables-with-content-api).

## 10. Security, recovery, and service constraints

- Disable public signup; use owner-created invitations and email/password login. Configure production SMTP for invitation and recovery delivery; Supabase's default mail service is not a production assumption. [Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- Every database mutation checks the active membership at request time. RLS and restricted RPC execution prevent role escalation and direct API bypass. Security-definer functions must set a safe search_path, validate auth.uid/role, and have narrowly granted EXECUTE privileges.
- Keep Twilio credentials, Supabase privileged keys, database passwords, and cron secret server-side. Publishable Supabase keys are not privileged but require correct RLS.
- Verify Twilio signatures against the exact externally visible callback URL and submitted form parameters using the supported helper for the runtime. A public callback route without a Supabase JWT is allowed only because it has Twilio signature verification. [Webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security).
- Restrict cross-origin mutations; validate origin on cookie-authenticated requests and escape displayed text. Never render instruction HTML as trusted markup. Rate-limit manual actions in the database to 5 per user/hour and 20 total/day; each action may include multiple recipients, so these are action limits, not a 20-recipient limit. Daily digest is outside this cap. Repeated use of one idempotency key does not consume additional quota. Track actual message counts/cost separately and display fan-out before manual submission.
- Use private repositories and sample data in development. Test mode may send only to an owner-controlled allowlisted number. Preview deployments must never access production sending credentials or a production write connection.
- Keep audit and delivery metadata for one year by default; keep task/meeting records until explicit owner archival. Purge raw provider payload details after 30 days while retaining safe event fingerprints/statuses. No automatic hard deletion of tasks in version 1.
- Daily encrypted backup of app data, schema/migrations, and membership identity mapping is required for live operation. Restore into an isolated project must be rehearsed. Auth configuration, credentials, Vault secrets, and scheduler configuration need separate secure recovery records; a CSV export alone is not a backup.
- Recovery objectives: target at most 24 hours of lost data and restoration within one business day. These are operating targets dependent on backup and owner availability, not free-tier SLAs. After restore, keep sending disabled and reconcile message records with Twilio before enabling reminders.

Supabase Free currently includes 500 MB database storage but may pause after inactivity and lacks automatic database backups. A cron job must not be assumed to eliminate pausing. Supabase Pro currently starts at $25/month with daily backups. [Supabase pricing](https://supabase.com/pricing).

## 11. Costs and unresolved launch gates

The accepted target is minimum recurring cost. Do not purchase a plan or claim permanent free production hosting on the basis of this document.

| Component | Starting choice | Cost / condition |
|---|---|---|
| Website | Vercel | Hobby $0 only if permitted for this use; public pricing describes personal, non-commercial use. Pro starts at $20/month. Obtain eligibility confirmation for office use or ask owner to choose paid hosting or a revised host. |
| Database/Auth/worker | Supabase Free | $0 within quotas; pausing, backups, function and email constraints must be managed; Pro $25/month optional only with approval |
| WhatsApp | Twilio pay-as-you-go | $0.005 per incoming/outgoing message plus applicable Meta fees, number costs, and taxes |
| Authentication email | Existing office SMTP | Use only if authorised and permitted for transactional mail; otherwise select a verified provider/free tier before launch |
| Backups/monitoring | Existing approved private storage and independent scheduler/monitor | Capacity, availability, and any cost must be recorded; never advertise as free without checking |
| Domain | Default platform domain | No separate domain purchase required for pilot; office domain may simplify email and production identity |
| AI/n8n | None | No subscription needed for dates or reminders |

At 30 outgoing messages, Twilio's portion alone is $0.15; at 60 it is $0.30. These are not total WhatsApp quotes. Applicable Pakistan Meta rates, approved category, sender charges, and monthly volume must be recorded from the provider account before live activation. [Twilio pricing](https://www.twilio.com/en-us/whatsapp/pricing), [Vercel pricing](https://vercel.com/pricing).

Multiple recipients multiply message usage: 10 recipients receiving one digest on each of 30 days means 300 messages and $1.50 in Twilio per-message fees alone; 100 recipients under the same assumption means 3,000 messages and $15.00, before Meta/number/tax charges. Actual volume depends on which recipients have due items each day plus manual messages and inbound traffic. The one-combined-message rule applies per recipient, not once across the entire office.

Government entities must access WhatsApp Business Platform through a solution provider under the published policy. Confirm Twilio can onboard this office and the intended sender. Do not misrepresent the office as a personal account to bypass onboarding. [WhatsApp policy](https://whatsappbusiness.com/policy/).

Launch gates: hosting eligibility/budget; permitted cloud handling of the office's intended data; active production sender and recipient opt-in; approved templates including overflow/manual; working recovery email; independent reminder monitor; encrypted backup and successful restore; authorised final recipient test. Build with mock delivery while these are unresolved.

## 12. Acceptance test matrix

| ID | Scenario | Required result |
|---|---|---|
| AT-01 | All date fixtures in section 6 | Exact dates/reminder instants match |
| AT-02 | Browser set to US timezone | Pakistan business dates unchanged |
| AT-03 | Leap year, month/year boundary, 0 days, negative/fraction input | Correct calendar arithmetic; reject invalid input |
| AT-04 | Specific Saturday meeting of every type | Monday effective date; Sunday reminder |
| AT-05 | Saturday task deadline | No meeting-style adjustment |
| AT-06 | Staff edits deadline | Saved immediately; reason/history/revision recorded |
| AT-07 | Two editors save the same version | First succeeds; second gets 409 and reload option |
| AT-08 | Staff reports complete | Still eligible with awaiting-confirmation label |
| AT-09 | Staff calls confirm-complete API/RPC directly | Denied with no mutation |
| AT-10 | Owner completes before send | Task deadline excluded; retained meetings behave per explicit choices |
| AT-11 | Several tasks plus multiple events on one task due tomorrow | One digest; correct grouping and every event recorded |
| AT-12 | No due items | No provider call; daily run records empty |
| AT-13 | Task entered at 14:00 after its scheduled reminder | No automatic send; manual action visible |
| AT-14 | Double-click/manual request replay | One logical message and one provider submission |
| AT-15 | Parallel scheduler/manual attempts | No duplicate event occurrence claimed |
| AT-16 | Worker starts 09:10 after outage; task added 09:05 | Catch-up uses 09:00 cutoff; new task remains manual |
| AT-17 | First run resumes after 09:30 | Mark missed; no delayed auto digest |
| AT-18 | Provider accepts, then application times out/crashes | Unknown; no blind retry; callback can reconcile |
| AT-19 | Explicit retryable rejection | Bounded retries; no post-window send |
| AT-20 | Duplicate/out-of-order/forged callbacks | Idempotent states; forged callback rejected; no delivered-state regression |
| AT-21 | Date moved/cancelled after sent reminder | Manual correction warning; immutable earlier snapshot |
| AT-22 | >5 groups, long Unicode titles | One approved summary, total/remaining counts, full secure agenda; no omitted underlying events |
| AT-23 | Inactive/anonymous/viewer tries direct database write | Denied; disabled member cannot read with an old session |
| AT-24 | Editor manages task recipient then attempts office-wide scope/role/secret change | Task recipient change succeeds with audit; privileged changes denied through API and RPC |
| AT-25 | Password invite/reset links | Correct environment/domain; single account gets intended role |
| AT-26 | Preview/test environment attempts real recipient | Rejected by server-side allowlist/mode guard |
| AT-27 | Database/worker unavailable | Independent monitoring alerts owner; UI reports stale heartbeat on return |
| AT-28 | Restore isolated backup | Records, identities/access mapping, and dates validated; no automatic messages replayed |
| AT-29 | Complete meeting, add follow-up after four days | Actual meeting date used; new linked record; old outcome preserved |
| AT-30 | Manual action outside morning schedule or over quota | Previewed action allowed at any time within quota; over-quota send blocked with clear next action |
| AT-31 | CSV cells start =, +, -, @ | Export neutralises spreadsheet formulas |
| AT-32 | 360px screen and keyboard-only usage | Add/edit/preview/confirm usable without inaccessible controls |
| AT-33 | ACS(G), task officer and department contact have different scopes | Each receives only their relevant events; ACS(G) receives office-wide digest |
| AT-34 | One contact has overlapping task/department/meeting subscriptions | One daily message with no duplicated event entries |
| AT-35 | Team adds two formats of the same phone number | Normalised duplicate prevented; reuse existing contact |
| AT-36 | Contact added after cutoff; contact opts out before queued send | New contact offered manual action; opted-out contact receives nothing |
| AT-37 | One contact fails while others deliver | Partial success reported; successful contacts never retried |
| AT-38 | Hundreds of eligible contacts exceed one worker batch | Durable continuation; no dropped/duplicate contacts; overdue queue flagged at cutoff |
| AT-39 | Manual multi-recipient double-click/retry | One child message per selected contact; accurate parent counts; no second send to successful contacts |
| AT-40 | Recipient contact has no app login | WhatsApp allowed with consent; private agenda denies anonymous access; contact addition grants no account |

## 13. Release definition

The release is ready only when all required acceptance tests pass, actual email and test-number WhatsApp delivery are verified, a clean database can be built from migrations, secrets are absent from the client bundle/repository, the owner has a runbook, and all launch gates are resolved. A mock demonstration is not production completion.

Initial capacity target: 25 active users, 50 departments, 10,000 tasks, and 50,000 meeting/update records, with indexed/paginated reads. Measure representative warm list responses under two seconds in staging and document cold-start behaviour; do not promise a paid-tier SLA on free services.

Run a seven-day pilot on an owner-controlled recipient with synthetic or authorised pilot data. Inspect the first Sunday/Monday rollover explicitly. Only after the final recipient test is authorised should the owner enable live automatic sending. No reminder to ACS(G) is authorised merely by this PRD.
