const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
const to = process.env.WHATSAPP_TO;
const contentSid = process.env.TWILIO_CONTENT_SID;

if (!accountSid || !authToken || !to || !contentSid) {
  throw new Error(
    "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WHATSAPP_TO, and TWILIO_CONTENT_SID.",
  );
}

if (!/^whatsapp:\+[1-9][0-9]{7,14}$/.test(to)) {
  throw new Error("WHATSAPP_TO must use whatsapp:+<E.164 number> format.");
}

const contentVariables = {};
if (process.env.TWILIO_CONTENT_VARIABLES) {
  try {
    Object.assign(contentVariables, JSON.parse(process.env.TWILIO_CONTENT_VARIABLES));
  } catch {
    throw new Error("TWILIO_CONTENT_VARIABLES must be valid JSON.");
  }
}

const client = twilio(accountSid, authToken);

async function createMessage() {
  const message = await client.messages.create({
    contentSid,
    ...(Object.keys(contentVariables).length
      ? { contentVariables: JSON.stringify(contentVariables) }
      : {}),
    from,
    to,
  });

  console.log(`Twilio message ${message.sid}: ${message.status}`);
}

createMessage().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
