"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      totpCode: needs2FA ? totpCode : "",
      redirect: false,
    });

    setLoading(false);

    if (res?.error === "2FA_REQUIRED") {
      setNeeds2FA(true);
      setError("Enter your authenticator code to continue.");
    } else if (res?.error) {
      setError(needs2FA ? "Invalid authenticator code." : "Invalid email or password");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">EdgeLog</h1>
          <p className="text-[var(--muted)] mt-1 text-sm">Sign in to your trading journal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!needs2FA && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-3 py-2.5 bg-[var(--card)] border border-[var(--card-border)] rounded-lg text-sm text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[var(--muted)]">Password</label>
                  <Link href="/forgot-password" className="text-xs text-[var(--accent)] hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2.5 bg-[var(--card)] border border-[var(--card-border)] rounded-lg text-sm text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </>
          )}

          {needs2FA && (
            <div>
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--accent)]">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </div>
                <p className="text-sm text-white font-medium">Two-factor authentication</p>
                <p className="text-xs text-[var(--muted)] mt-1">Enter the 6-digit code from your authenticator app</p>
              </div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Authenticator code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                autoFocus
                required
                className="w-full px-3 py-2.5 bg-[var(--card)] border border-[var(--card-border)] rounded-lg text-sm text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors tracking-widest text-center text-lg"
              />
              <button
                type="button"
                onClick={() => { setNeeds2FA(false); setTotpCode(""); setError(""); }}
                className="text-xs text-[var(--muted)] hover:text-white mt-2 block mx-auto transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          )}

          {error && (
            <p className={`text-xs px-3 py-2 rounded-lg ${needs2FA && !error.includes("Invalid auth") ? "text-[var(--accent)] bg-[var(--accent)]/10" : "text-[var(--red)] bg-[var(--red-dim)]"}`}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : needs2FA ? "Verify" : "Sign in"}
          </button>
        </form>

        {!needs2FA && (
          <>
            <p className="text-center text-xs text-[var(--muted)] mt-6">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-[var(--accent)] hover:underline">
                Register
              </Link>
            </p>

            <p className="text-center text-xs text-[var(--muted)] mt-4 border border-[var(--card-border)] rounded-lg px-3 py-2">
              Demo: demo@edgelog.io / password123
            </p>
          </>
        )}
      </div>
    </div>
  );
}
