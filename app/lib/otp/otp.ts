/**
 * lib/otp.ts
 *
 * MOCK OTP layer.
 *
 * For now every OTP that gets "sent" is the same hardcoded code below, and
 * nothing actually goes out over SMS/email — we just log it to the server
 * console so you can see it while testing the UI end-to-end.
 *
 * To wire up real delivery later:
 *   - SMS  -> swap `mockSend` for the Africa's Talking send() call you
 *             already have in app/api/sms/route.ts
 *   - Email -> swap for your transactional email provider (Resend/SES/etc)
 *
 * Everything else (generate/verify/expiry) can stay as-is — just replace
 * the body of `deliverOtp`.
 */

// 🔒 Hardcoded for local/dev testing only. Remove once real delivery is wired up.
export const HARDCODED_OTP = "123456";

export type OtpPurpose = "guarantor_verification" | "applicant_confirmation";

interface OtpRecord {
  code: string;
  purpose: OtpPurpose;
  identifier: string; // phone number or email the code was "sent" to
  expiresAt: number;
  attempts: number;
}

// In-memory store. Fine for a single dev server / demo.
// Replace with a Redis / DB-backed store (e.g. an `otp_codes` table) in production
// so codes survive server restarts and work across multiple instances.
const otpStore = new Map<string, OtpRecord>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

function storeKey(purpose: OtpPurpose, identifier: string) {
  return `${purpose}:${identifier}`;
}

/**
 * "Sends" an OTP. Currently just stores the hardcoded code and logs it.
 * Swap the inside of this function for a real SMS/email call later —
 * the function signature/return shape can stay the same.
 */
export async function sendOtp(purpose: OtpPurpose, identifier: string) {
  const code = HARDCODED_OTP; // TODO: replace with generateRandomOtp() once real delivery is live

  otpStore.set(storeKey(purpose, identifier), {
    code,
    purpose,
    identifier,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });

  // TODO: replace this block with a real SMS (Africa's Talking) / email send.
  // e.g. await smsClient.send({ to: identifier, message: `Your SaccoFX Pro code is ${code}` })
  console.log(`[MOCK OTP] purpose=${purpose} to=${identifier} code=${code}`);

  return { success: true, expiresInSeconds: OTP_TTL_MS / 1000 };
}

export type OtpVerifyResult =
  | { success: true }
  | { success: false; reason: "not_found" | "expired" | "too_many_attempts" | "incorrect_code" };

export function verifyOtp(purpose: OtpPurpose, identifier: string, code: string): OtpVerifyResult {
  const key = storeKey(purpose, identifier);
  const record = otpStore.get(key);

  if (!record) return { success: false, reason: "not_found" };

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(key);
    return { success: false, reason: "too_many_attempts" };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return { success: false, reason: "expired" };
  }

  if (record.code !== code) {
    record.attempts += 1;
    return { success: false, reason: "incorrect_code" };
  }

  otpStore.delete(key); // one-time use
  return { success: true };
}

function generateRandomOtp(length = 6) {
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 10);
  return out;
}