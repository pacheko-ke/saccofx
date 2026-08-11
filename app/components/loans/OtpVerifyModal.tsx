"use client";

import { useState, useEffect, useRef } from "react";

type OtpPurpose = "guarantor_verification" | "applicant_confirmation";

interface OtpVerifyModalProps {
  open: boolean;
  purpose: OtpPurpose;
  identifier: string; // phone number or email being verified
  title?: string;
  description?: React.ReactNode;
  onClose: () => void;
  onVerified: () => void;
}

export default function OtpVerifyModal({
  open,
  purpose,
  identifier,
  title = "Verify code",
  description,
  onClose,
  onVerified,
}: OtpVerifyModalProps) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "verifying" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      setCode(["", "", "", "", "", ""]);
      setStatus("idle");
      setErrorMsg("");
      handleSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  async function handleSend() {
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, identifier }),
      });
      if (!res.ok) throw new Error("Failed to send code");
      setStatus("sent");
      setSecondsLeft(60);
      // 🔒 Dev helper only — remove once real SMS/email delivery is wired up.
      // The hardcoded testing code is 123456.
    } catch (err) {
      setStatus("error");
      setErrorMsg("Couldn't send the code. Please try again.");
    }
  }

  function handleDigitChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setErrorMsg("Enter all 6 digits.");
      return;
    }
    setStatus("verifying");
    setErrorMsg("");
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, identifier, code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        setStatus("error");
        setErrorMsg(data.error ?? "Verification failed.");
        return;
      }
      onVerified();
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong verifying the code.");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c2b22]/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] shadow-xl">
        <div className="border-b border-[#c9a24b]/30 px-6 py-4">
          <h3 className="font-serif text-lg text-[#1c2b22]">{title}</h3>
          <p className="mt-1 text-sm text-[#4a5c50]">
            {description ?? (
              <>
                We sent a 6-digit code to <span className="font-medium">{identifier}</span>.
              </>
            )}
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="flex justify-between gap-2">
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                inputMode="numeric"
                maxLength={1}
                className="h-12 w-10 rounded-md border border-[#c9a24b]/50 bg-white text-center text-lg font-medium text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
              />
            ))}
          </div>

          {errorMsg && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}

          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleSend}
              disabled={secondsLeft > 0 || status === "sending"}
              className="text-[#1c2b22] underline disabled:text-[#9aa79f] disabled:no-underline"
            >
              {status === "sending"
                ? "Sending..."
                : secondsLeft > 0
                ? `Resend code in ${secondsLeft}s`
                : "Resend code"}
            </button>
            <span className="text-[#9aa79f]">
              Dev code: <span className="font-mono">123456</span>
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#c9a24b]/30 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-[#4a5c50] hover:bg-[#eee7d6]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={status === "verifying"}
            className="rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c] disabled:opacity-60"
          >
            {status === "verifying" ? "Verifying..." : "Verify"}
          </button>
        </div>
      </div>
    </div>
  );
}
