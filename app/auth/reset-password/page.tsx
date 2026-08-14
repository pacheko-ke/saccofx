"use client";

/**
 * app/reset-password/page.tsx
 *
 * Two-step reset password flow for SaccoFX Pro:
 *  1. No `token` in URL  -> member enters their email, we call
 *     POST /api/auth/forgot-password to send a reset link.
 *  2. `token` present    -> member sets a new password, we call
 *     POST /api/auth/reset-password with { token, password }.
 *
 * Styled with the passbook/ledger brand:
 *   ink-green #1c2b22 · cream #faf6ec / #eee7d6 · brass gold #c9a24b
 */

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type Status = "idle" | "submitting" | "success" | "error";

function PasswordStrengthBar({ password }: { password: string }) {
  const score = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  })();

  const labels = ["Weak", "Fair", "Good", "Strong"];
  const colors = ["#b23b3b", "#c9a24b", "#7a8f5c", "#1c2b22"];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 h-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1 rounded-full transition-colors duration-300"
            style={{
              backgroundColor: i < score ? colors[score - 1] : "#e3dac8",
            }}
          />
        ))}
      </div>
      <p
        className="mt-1 text-xs font-serif"
        style={{ color: colors[Math.max(score - 1, 0)] }}
      >
        {score > 0 ? labels[score - 1] : "Too short"}
      </p>
    </div>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // Step 1 state (request link)
  const [email, setEmail] = useState("");

  // Step 2 state (set new password)
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [tokenValid, setTokenValid] = useState<boolean | null>(
    token ? null : true
  );

  // Optional: verify token on mount if present
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`
        );
        setTokenValid(res.ok);
      } catch {
        setTokenValid(false);
      }
    })();
  }, [token]);

  async function handleRequestLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not send reset link.");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not reset password.");
      }
      setStatus("success");
      setTimeout(() => router.push("/auth/login"), 2500);
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#eee7d6" }}
    >
      <div
        className="w-full max-w-md rounded-sm shadow-lg overflow-hidden border"
        style={{ backgroundColor: "#faf6ec", borderColor: "#c9a24b33" }}
      >
        {/* Ledger header band */}
        <div
          className="px-8 py-6 border-b-2"
          style={{ backgroundColor: "#1c2b22", borderColor: "#c9a24b" }}
        >
          <div className="flex items-center gap-3">
            
            <div className="flex flex-col gap-1">
              <p
                className="font-serif text-lg leading-tight"
                style={{ color: "#faf6ec" }}
              >
                saccofx pro
              </p>
              <p
                className="text-xs tracking-wide uppercase"
                style={{ color: "#c9a24b" }}
              >
                Member Account Recovery
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-8">
          {/* ---- Invalid / expired token ---- */}
          {token && tokenValid === false && (
            <div className="text-center">
              <h1
                className="font-serif text-xl mb-2"
                style={{ color: "#1c2b22" }}
              >
                This link has expired
              </h1>
              <p className="text-sm mb-6" style={{ color: "#5c5442" }}>
                Reset links are valid for a limited time. Please request a
                new one.
              </p>
              <a
                href="/reset-password"
                className="inline-block px-5 py-2.5 rounded-sm text-sm font-medium transition-colors"
                style={{ backgroundColor: "#1c2b22", color: "#faf6ec" }}
              >
                Request a new link
              </a>
            </div>
          )}

          {/* ---- Step 1: request reset link ---- */}
          {!token && status !== "success" && (
            <>
              <h1
                className="font-serif text-xl mb-1"
                style={{ color: "#1c2b22" }}
              >
                Reset your password
              </h1>
              <p className="text-sm mb-6" style={{ color: "#5c5442" }}>
                Enter the email linked to your SACCO membership and we'll
                send you a reset link.
              </p>

              <form onSubmit={handleRequestLink} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs uppercase tracking-wide mb-1.5"
                    style={{ color: "#1c2b22" }}
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-sm border text-sm outline-none transition-colors focus:ring-1"
                    style={{
                      borderColor: "#c9a24b66",
                      backgroundColor: "#fffdf8",
                      color: "#1c2b22",
                    }}
                  />
                </div>

                {status === "error" && (
                  <p className="text-sm" style={{ color: "#b23b3b" }}>
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="w-full py-2.5 rounded-sm text-sm font-medium transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: "#1c2b22", color: "#faf6ec" }}
                >
                  {status === "submitting" ? "Sending link…" : "Send reset link"}
                </button>
              </form>

              <div
                className="mt-6 pt-6 text-center text-sm border-t"
                style={{ borderColor: "#c9a24b33" }}
              >
                <a
                  href="/auth/login"
                  className="font-medium hover:underline"
                  style={{ color: "#1c2b22" }}
                >
                  ← Back to login
                </a>
              </div>
            </>
          )}

          {/* ---- Step 1 success ---- */}
          {!token && status === "success" && (
            <div className="text-center">
              <div
                className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#1c2b2214" }}
              >
                <span style={{ color: "#1c2b22" }}>✓</span>
              </div>
              <h1
                className="font-serif text-xl mb-2"
                style={{ color: "#1c2b22" }}
              >
                Check your email
              </h1>
              <p className="text-sm" style={{ color: "#5c5442" }}>
                If an account exists for <strong>{email}</strong>, a reset
                link has been sent. It will expire in 30 minutes.
              </p>
            </div>
          )}

          {/* ---- Step 2: set new password ---- */}
          {token && tokenValid && status !== "success" && (
            <>
              <h1
                className="font-serif text-xl mb-1"
                style={{ color: "#1c2b22" }}
              >
                Set a new password
              </h1>
              <p className="text-sm mb-6" style={{ color: "#5c5442" }}>
                Choose a strong password you haven't used before.
              </p>

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs uppercase tracking-wide mb-1.5"
                    style={{ color: "#1c2b22" }}
                  >
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-sm border text-sm outline-none transition-colors focus:ring-1"
                    style={{
                      borderColor: "#c9a24b66",
                      backgroundColor: "#fffdf8",
                      color: "#1c2b22",
                    }}
                  />
                  <PasswordStrengthBar password={password} />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs uppercase tracking-wide mb-1.5"
                    style={{ color: "#1c2b22" }}
                  >
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-sm border text-sm outline-none transition-colors focus:ring-1"
                    style={{
                      borderColor: "#c9a24b66",
                      backgroundColor: "#fffdf8",
                      color: "#1c2b22",
                    }}
                  />
                </div>

                {errorMessage && (
                  <p className="text-sm" style={{ color: "#b23b3b" }}>
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="w-full py-2.5 rounded-sm text-sm font-medium transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: "#1c2b22", color: "#faf6ec" }}
                >
                  {status === "submitting" ? "Updating…" : "Update password"}
                </button>
              </form>
            </>
          )}

          {/* ---- Step 2 success ---- */}
          {token && status === "success" && (
            <div className="text-center">
              <div
                className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#1c2b2214" }}
              >
                <span style={{ color: "#1c2b22" }}>✓</span>
              </div>
              <h1
                className="font-serif text-xl mb-2"
                style={{ color: "#1c2b22" }}
              >
                Password updated
              </h1>
              <p className="text-sm" style={{ color: "#5c5442" }}>
                Redirecting you to login…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}