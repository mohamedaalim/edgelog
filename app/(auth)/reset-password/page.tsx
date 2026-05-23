"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");

  const inputCls = "w-full px-3 py-2.5 bg-[var(--card)] border border-[var(--card-border)] rounded-lg text-sm text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors";

  useEffect(() => {
    if (!token) setError("Missing reset token — please use the link from your email.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setStatus("loading"); setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setStatus("done");
      setTimeout(() => router.push("/login"), 2500);
    } catch (e: unknown) {
      setError((e as Error).message);
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 text-center space-y-3">
        <div className="text-4xl">✅</div>
        <p className="text-white font-semibold">Password updated</p>
        <p className="text-sm text-[var(--muted)]">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">New password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters" required autoComplete="new-password" className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Confirm new password</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat password" required autoComplete="new-password" className={inputCls} />
      </div>
      {error && <p className="text-xs text-[var(--red)] bg-[var(--red-dim)] px-3 py-2 rounded-lg">{error}</p>}
      <button type="submit" disabled={status === "loading" || !token}
        className="w-full py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
        {status === "loading" ? "Updating…" : "Set new password"}
      </button>
      <p className="text-center text-xs text-[var(--muted)]">
        <Link href="/login" className="text-[var(--accent)] hover:underline">Back to sign in</Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">EdgeLog</h1>
          <p className="text-[var(--muted)] mt-1 text-sm">Set a new password</p>
        </div>
        <Suspense fallback={<div className="text-center text-[var(--muted)] text-sm">Loading…</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
