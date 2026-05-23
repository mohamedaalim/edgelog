"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState("");

  const inputCls = "w-full px-3 py-2.5 bg-[var(--card)] border border-[var(--card-border)] rounded-lg text-sm text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading"); setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setStatus("sent");
    } catch (e: unknown) {
      setError((e as Error).message);
      setStatus("idle");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">EdgeLog</h1>
          <p className="text-[var(--muted)] mt-1 text-sm">Reset your password</p>
        </div>

        {status === "sent" ? (
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 text-center space-y-4">
            <div className="text-4xl">📧</div>
            <p className="text-white font-semibold">Check your inbox</p>
            <p className="text-sm text-[var(--muted)]">
              If <span className="text-white">{email}</span> is registered, you&apos;ll receive a reset link within a few minutes. The link expires in 2 hours.
            </p>
            <Link href="/login" className="block text-sm text-[var(--accent)] hover:underline mt-2">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-[var(--muted)]">Enter your account email and we&apos;ll send you a reset link.</p>
            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={inputCls}
              />
            </div>
            {error && <p className="text-xs text-[var(--red)] bg-[var(--red-dim)] px-3 py-2 rounded-lg">{error}</p>}
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {status === "loading" ? "Sending…" : "Send reset link"}
            </button>
            <p className="text-center text-xs text-[var(--muted)]">
              <Link href="/login" className="text-[var(--accent)] hover:underline">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
