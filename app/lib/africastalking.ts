// lib/africastalking.ts
import AfricasTalking from 'africastalking';

const AT_USERNAME = process.env.AT_USERNAME;
const AT_API_KEY = process.env.AT_API_KEY;
const AT_SENDER_ID = process.env.AT_SENDER_ID; // optional; omit to use AT's shared shortcode

if (!AT_USERNAME || !AT_API_KEY) {
  console.warn('Africa\'s Talking credentials missing — SMS sending will fail at runtime.');
}

const africastalking = AfricasTalking({
  apiKey: AT_API_KEY ?? '',
  username: AT_USERNAME ?? '',
});

const smsService = africastalking.SMS;

/**
 * Normalizes Kenyan phone numbers to E.164 format (+254XXXXXXXXX).
 * Accepts formats like: 0712345678, 712345678, +254712345678, 254712345678
 */
export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');

  if (digits.startsWith('+254') && digits.length === 13) {
    return digits;
  }
  if (digits.startsWith('254') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+254${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    // e.g. 712345678 with leading 0 stripped already
    return `+254${digits}`;
  }

  throw new Error(`Unrecognized phone number format: ${raw}`);
}

export interface SendSMSResult {
  recipient: string;
  status: string;
  messageId?: string;
  cost?: string;
}

/**
 * Sends a single SMS via Africa's Talking.
 * Throws on transport/config failure; check the returned status for
 * per-recipient delivery outcome (e.g. "Success", "InvalidPhoneNumber").
 */
export async function sendSMS(
  to: string,
  message: string,
  opts: { senderId?: string } = {}
): Promise<SendSMSResult> {
  if (!AT_USERNAME || !AT_API_KEY) {
    throw new Error('Africa\'s Talking credentials are not configured');
  }

  const recipient = normalizePhoneNumber(to);

  const payload: Record<string, any> = {
    to: [recipient],
    message,
  };

  const senderId = opts.senderId ?? AT_SENDER_ID;
  if (senderId) {
    payload.from = senderId;
  }

  try {
    const response = await smsService.send(payload);
    const recipientResult = response?.SMSMessageData?.Recipients?.[0];

    if (!recipientResult) {
      throw new Error('No recipient result returned from Africa\'s Talking');
    }

    return {
      recipient: recipientResult.number,
      status: recipientResult.status,
      messageId: recipientResult.messageId,
      cost: recipientResult.cost,
    };
  } catch (err) {
    console.error('Africa\'s Talking SMS send failed:', err);
    throw new Error(
      err instanceof Error ? `SMS send failed: ${err.message}` : 'SMS send failed'
    );
  }
}

/**
 * Sends the same message to multiple recipients in a single API call.
 * More efficient than looping sendSMS() for bulk notifications
 * (e.g. dividend announcements, AGM reminders).
 */
export async function sendBulkSMS(
  recipients: string[],
  message: string,
  opts: { senderId?: string } = {}
): Promise<SendSMSResult[]> {
  if (!AT_USERNAME || !AT_API_KEY) {
    throw new Error('Africa\'s Talking credentials are not configured');
  }

  const normalized = recipients.map(normalizePhoneNumber);

  const payload: Record<string, any> = {
    to: normalized,
    message,
  };

  const senderId = opts.senderId ?? AT_SENDER_ID;
  if (senderId) {
    payload.from = senderId;
  }

  const response = await smsService.send(payload);
  const results = response?.SMSMessageData?.Recipients ?? [];

  return results.map((r: any) => ({
    recipient: r.number,
    status: r.status,
    messageId: r.messageId,
    cost: r.cost,
  }));
}