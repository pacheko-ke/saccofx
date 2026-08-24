import { NextResponse } from "next/server";

// Daraja API Configuration
const DARAJA_CONSUMER_KEY = process.env.DARAJA_CONSUMER_KEY || "";
const DARAJA_CONSUMER_SECRET = process.env.DARAJA_CONSUMER_SECRET || "";
const DARAJA_BUSINESS_SHORTCODE = process.env.DARAJA_BUSINESS_SHORTCODE || "";
const DARAJA_PASSKEY = process.env.DARAJA_PASSKEY || "";
const DARAJA_CALLBACK_URL = process.env.DARAJA_CALLBACK_URL || "https://yourdomain.com/api/payments/callback";

// Helper: Generate OAuth Token for Safaricom Daraja API
async function getMpesaAccessToken(): Promise<string> {
  const auth = Buffer.from(`${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`).toString("base64");
  
  const res = await fetch(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error("Failed to acquire M-PESA OAuth token");
  }

  const data = await res.json();
  return data.access_token;
}

// Helper: Format Kenyan Phone Number to 254XXXXXXXXX
function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[^\d]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "254" + cleaned.slice(1);
  } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
    cleaned = "254" + cleaned;
  }
  return cleaned;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { memberId, targetId, amount, narration, paymentMethod, details} = body;

    if (!memberId || !targetId || !amount || amount <= 0) {
      return NextResponse.json({ error: "Missing or invalid payment parameters." }, { status: 400 });
    }

    // 2. Handle M-PESA STK Push
    if (paymentMethod === "mpesa") {
      if (!details?.mpesaPhoneNumber) {
        return NextResponse.json({ error: "Phone number is required for M-PESA." }, { status: 400 });
      }

      const formattedPhone = formatPhone(details.mpesaPhoneNumber);
      const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
      const password = Buffer.from(
        `${DARAJA_BUSINESS_SHORTCODE}${DARAJA_PASSKEY}${timestamp}`
      ).toString("base64");

      const accessToken = await getMpesaAccessToken();

      const stkPayload = {
        BusinessShortCode: DARAJA_BUSINESS_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: DARAJA_BUSINESS_SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: DARAJA_CALLBACK_URL,
        AccountReference: targetId.slice(0, 12), // Max 12 characters
        TransactionDesc: narration || "Sacco Payment",
      };

      const stkRes = await fetch(
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(stkPayload),
        }
      );

      const stkData = await stkRes.json();

      if (!stkRes.ok || stkData.ResponseCode !== "0") {
        return NextResponse.json(
          { error: stkData.errorMessage || stkData.ResponseDescription || "Failed to initiate M-PESA prompt." },
          { status: 400 }
        );
      }

      // TODO: Save pending transaction record to your database using stkData.CheckoutRequestID
      

      return NextResponse.json({
        success: true,
        message: "M-PESA prompt sent successfully.",
        transactionRef: stkData.CheckoutRequestID,
      });
    }

    // 3. Handle Bank Wire & Cheque Deposits
    if (paymentMethod === "bank_transfer" || paymentMethod === "check") {
      const reference = paymentMethod === "bank_transfer" ? details?.bankReference : details?.chequeNumber;

      if (!reference) {
        return NextResponse.json(
          { error: `Missing reference for ${paymentMethod.replace("_", " ")}.` },
          { status: 400 }
        );
      }

      const internalRef = `${paymentMethod === "bank_transfer" ? "BNK" : "CHQ"}-${Date.now().toString().slice(-6)}`;

      // TODO: Save record to Database under a "PENDING_AUDIT" status for admin reconciliation

      return NextResponse.json({
        success: true,
        message: "Payment reference recorded for manual reconciliation.",
        transactionRef: internalRef,
      });
    }

    return NextResponse.json({ error: "Unsupported payment method." }, { status: 400 });
  } catch (error: any) {
    console.error("Payment route error:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred while processing the payment." },
      { status: 500 }
    );
  }
}