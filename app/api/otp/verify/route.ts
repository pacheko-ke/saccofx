import { NextRequest, NextResponse } from "next/server";
import { verifyOtp, OtpPurpose } from "@/app/lib/otp";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { purpose, identifier, code } = body as {
      purpose: OtpPurpose;
      identifier: string;
      code: string;
    };

    if (!purpose || !identifier || !code) {
      return NextResponse.json({ error: "purpose, identifier and code are required" }, { status: 400 });
    }

    const result = verifyOtp(purpose, identifier, code);

    if (!result.success) {
      const messages: Record<string, string> = {
        not_found: "No OTP was requested for this contact. Please resend the code.",
        expired: "This code has expired. Please resend the code.",
        too_many_attempts: "Too many incorrect attempts. Please resend the code.",
        incorrect_code: "Incorrect code. Please try again.",
      };
      return NextResponse.json(
        { verified: false, error: messages[result.reason] ?? "Verification failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error("OTP verify error:", err);
    return NextResponse.json({ error: "Failed to verify OTP" }, { status: 500 });
  }
}
