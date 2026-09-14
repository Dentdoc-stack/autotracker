# Activate the ACS(G) WhatsApp template

This release replaces trial/sample message variables with fields from the saved database records. GitHub deployment alone does not create or approve a Twilio template or redeploy Supabase functions.

## Create the template in Twilio

Open Messaging > Content Template Builder. Create a Text template named `acs_followup_v1`, language English. Paste this exact body:

```text
ACS(G) Office — Follow-up reminder
Instruction: {{1}}
Department: {{2}}
Due date: {{3}}
Action required: {{4}}
Please coordinate the update or meeting with the office.
```

Use these illustrative samples for approval only:

1. ACS-1 — Policy review: Review the accessibility policy and provide recommendations.
2. Social Welfare
3. 22 Sept 2026
4. Update due

Submit for WhatsApp approval with the appropriate utility category. Approval and sender eligibility are provider decisions. This is not the generic trial appointment template. A trial/sandbox may not support your custom approved template; complete the appropriate sender onboarding before relying on scheduled messages.

## Configure and deploy

1. After approval, copy the NEW HX Content SID into Supabase Edge Function secret `TWILIO_DIGEST_CONTENT_SID`.
2. Set `TWILIO_TEMPLATE_VERSION` to `acs_followup_v1`. This is a compatibility acknowledgement, not proof of provider approval.
3. Remove `TWILIO_DIGEST_CONTENT_VARIABLES`; the worker now ignores that old override and always supplies all four fields. Do not put fixed dates in secrets.
4. Keep test mode and your consenting test phone allowlisted. Keep live sending off during setup.
5. From the latest repository, run `npx supabase link --project-ref YOUR_PROJECT_REFERENCE`, then `npx supabase db push` to ensure all committed migrations are applied.
6. Run `npx supabase functions deploy reminder-dispatch`. The shared template module is included by its import. Vercel does not deploy this function.
7. Create a NEW test instruction with a known date; preview it, then queue one authorised test. Compare the received instruction, department, date and action. Existing accepted or uncertain messages must not be blindly replayed.

## Exact behaviour and limits

- Uses full saved instruction text, with whitespace collapsed because WhatsApp template variables cannot contain newlines. Quotes and backslashes are JSON encoded correctly.
- Task events use the saved deadline. Meeting events use the effective meeting date (including Monday adjustment) and saved time labelled PKT. No sample date or current send date replaces those dates.
- Multiple items remain in one recipient message; matching numbered entries align the four fields.
- Uses all items, not the previous five-item/700-character shortened summary. Messages longer than the application's conservative 1024-character rendered limit fail visibly before provider submission; nothing is silently truncated. Automatic overflow splitting is not implemented.
- The app preview/history still displays the database digest layout. WhatsApp displays the four-field template layout using the same saved records.
- `send_whatsapp.js` is a separate standalone test and is not used by the tracker. Do not use an old trial Content SID there to test this integration.

Reference: https://www.twilio.com/docs/content/using-variables-with-content-api
