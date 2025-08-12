import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

export const sendSMS = async (to, message) => {
  const formatted = formatPhoneNumber(to);
  if (!formatted) throw new Error(`Invalid phone number: ${to}`);

  try {
    const result = await client.messages.create({
      body: message,
      from: twilioPhone,
      to: formatted,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    });
    console.log("SMS sent:", result.sid);
    return result;
  } catch (error) {
    console.error("Failed to send SMS:", error.message);
    throw error;
  }
};

function formatPhoneNumber(number) {
  const trimmed = number.toString().trim();
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.length === 10) return `+91${trimmed}`;
  if (trimmed.length === 12 && trimmed.startsWith("91")) return `+${trimmed}`;
  return null;
}
