"use client";

import { useState } from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  date: string;
  journal: {
    prePlanning?: string;
    postReview?: string;
    mood?: number;
    focus?: number;
  };
  existingFeedback?: string | null;
}

export function AICoachCard({ date, journal, existingFeedback }: Props) {
  const [feedback, setFeedback] = useState(existingFeedback ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setFeedback("");

    try {
      const res = await fetch("/api/ai/journal-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, journal }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to generate feedback");
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setFeedback((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gradient-to-br from-[var(--accent)]/10 to-transparent border border-[var(--accent)]/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-[var(--accent)]" />
          <span className="text-sm font-semibold text-white">AI Coach Feedback</span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
            "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-50"
          )}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? "Analyzing…" : feedback ? "Regenerate" : "Get Feedback"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-[var(--red)] bg-[var(--red-dim)] px-3 py-2 rounded-lg mb-2">{error}</p>
      )}

      {!feedback && !loading && (
        <p className="text-xs text-[var(--muted)]">
          Get personalized coaching on today&apos;s trading session — analysis based on your actual trades and journal.
          {!process.env.NEXT_PUBLIC_HAS_AI && " (Requires ANTHROPIC_API_KEY in .env)"}
        </p>
      )}

      {(feedback || loading) && (
        <div className="prose prose-invert prose-sm max-w-none">
          <div className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
            {feedback}
            {loading && <span className="inline-block w-1.5 h-4 bg-[var(--accent)] animate-pulse ml-0.5 align-middle" />}
          </div>
        </div>
      )}
    </div>
  );
}
