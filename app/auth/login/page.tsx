"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, remember }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Login failed. Please try again.");
        setLoading(false);
        return;
      }

      router.push(data.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please check your connection.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1c2b22] px-4 md:px-4 py-12">
     
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #faf6ec 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Brand mark */}
        <div className="mb-8 text-center">
         
          <h1 className="mt-4 font-serif text-2xl tracking-tight text-[#faf6ec]">
            saccofx pro.
          </h1>
          <p className="mt-1 text-sm text-[#faf6ec]/60">
            Sign in to your SACCO account
          </p>
        </div>
 <div className="flex flex-col py-2 demo-credentials mb-2  rounded-sm pl-2 text-[#faf6ec]/40 tracking-wide font-sm text-md ">
  <h1 >Demo credentials</h1>
              <h1>username: member.55b2550c </h1>
              <h1>password: demo </h1>
            </div>
        {/* Card with perforated left edge, passbook motif */}
        <div className="relative overflow-hidden rounded-lg bg-[#faf6ec] shadow-2xl">
          <div
            className="absolute left-0 top-0 h-full w-3 bg-[#eee7d6]"
            style={{
              backgroundImage:
                "radial-gradient(circle, #faf6ec 3px, transparent 3px)",
              backgroundSize: "12px 16px",
              backgroundPosition: "center",
            }}
          />

          <form onSubmit={handleSubmit} className="px-4 md:px-8 pl-5 py-7 ">
            {error && (
              <div className="mb-5 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

           

            <div className="space-y-5">
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/60"
                >
                  Member No. / Phone / Email
                </label>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. SFX-00214 or 07XX XXX XXX"
                  className="mt-1.5 w-full rounded-md border border-[#1c2b22]/15 bg-white px-3.5 py-2.5 text-sm text-[#1c2b22] placeholder:text-[#1c2b22]/30 focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/60"
                  >
                    Password
                  </label>
                  <a
                    href="/auth/reset-password"
                    className="text-xs text-[#c9a24b] hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative mt-1.5">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-md border border-[#1c2b22]/15 bg-white px-3.5 py-2.5 pr-11 text-sm text-[#1c2b22] placeholder:text-[#1c2b22]/30 focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#1c2b22]/50 hover:text-[#1c2b22]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-[#1c2b22]/70">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-[#1c2b22]/25 text-[#c9a24b] focus:ring-[#c9a24b]"
                />
                Keep me signed in
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-[#1c2b22] py-2.5 text-sm font-medium text-[#faf6ec] transition-colors hover:bg-[#1c2b22]/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </div>

            {/* <p className="mt-6 text-center text-sm text-[#1c2b22]/60">
              Not a member yet?{" "}
              <a href="/register" className="text-[#c9a24b] hover:underline">
                Join the SACCO
              </a>
            </p> */}
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[#faf6ec]/40">
          Regulated under SASRA.
        </p>
          <p className="mt-2 text-center text-xs text-[#faf6ec]/40 " >
           <a href="https://wa.me/254769869064">Powered by <span className="underline underline-offset-4">Pacheko Technologies.</span></a>
        </p>
      </div>
    </div>
  );
}
