"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// ── Types ────────────────────────────────────────────────────────────────────
type MessageRole = "user" | "assistant";
interface Message { id: string; role: MessageRole; content: string; streaming?: boolean; }
type InsightType = "strength" | "warning" | "pattern" | "focus";
interface InsightCard {
  id: string; type: InsightType; title: string; content: string;
  metric?: { label: string; value: string };
  priority: number;
}
interface InsightsResponse { configured: boolean; insights?: InsightCard[]; error?: string; }

type DigestCategory = "psychology" | "timing" | "setup" | "risk" | "overtrading";
interface DigestFinding {
  id: string; title: string; category: DigestCategory; severity: "high" | "medium" | "low";
  dollarImpact: number; evidence: string; description: string; action: string;
}
interface DigestRecord {
  id: string; weekOf: string; summary: string; findings: DigestFinding[];
  tradeCount: number; netPnl: number; createdAt: string;
}
interface DigestResponse {
  configured: boolean; digest: DigestRecord | null; cached?: boolean;
  message?: string; error?: string;
}

// ── Insight Card Colors ───────────────────────────────────────────────────────
const INSIGHT_STYLES: Record<InsightType, { bg: string; border: string; badge: string; icon: string }> = {
  strength: { bg: "var(--green-dim)", border: "rgba(34,197,94,0.25)", badge: "bg-[var(--green-dim)] text-[var(--green)]", icon: "↑" },
  warning:  { bg: "var(--red-dim)",   border: "rgba(239,68,68,0.25)",  badge: "bg-[var(--red-dim)] text-[var(--red)]",   icon: "!" },
  pattern:  { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.25)", badge: "bg-purple-500/10 text-purple-400", icon: "~" },
  focus:    { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)", badge: "bg-blue-500/10 text-blue-400",     icon: "→" },
};

// ── Digest severity styles ────────────────────────────────────────────────────
const SEVERITY_STYLES = {
  high:   { badge: "bg-[var(--red-dim)] text-[var(--red)]", dot: "bg-[var(--red)]" },
  medium: { badge: "bg-yellow-500/10 text-yellow-400",      dot: "bg-yellow-400" },
  low:    { badge: "bg-[var(--card-border)] text-[var(--muted)]", dot: "bg-[var(--muted)]" },
};
const CATEGORY_ICONS: Record<string, string> = {
  psychology: "🧠", timing: "⏱", setup: "📋", risk: "⚠️", overtrading: "🔄",
};

// ── DigestFindingCard ─────────────────────────────────────────────────────────
function DigestFindingCard({ finding }: { finding: DigestFinding }) {
  const [open, setOpen] = useState(false);
  const sev = SEVERITY_STYLES[finding.severity];
  const impact = finding.dollarImpact;
  const positive = impact > 0;
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] overflow-hidden">
      <button className="w-full text-left px-3.5 py-3 flex items-start gap-2.5" onClick={() => setOpen(!open)}>
        <span className="text-base mt-0.5 shrink-0">{CATEGORY_ICONS[finding.category] ?? "◈"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-semibold text-white truncate">{finding.title}</span>
            <span className={`text-xs font-bold shrink-0 ${positive ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
              {positive ? "+" : ""}${Math.abs(impact).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full uppercase ${sev.badge}`}>{finding.severity}</span>
            <span className="text-[0.65rem] text-[var(--muted)] capitalize">{finding.category}</span>
          </div>
        </div>
        <span className="text-[var(--muted)] text-xs mt-1 shrink-0">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-[var(--card-border)] pt-3">
          <div className="bg-[var(--background)] rounded-lg px-3 py-2">
            <p className="text-[0.65rem] text-[var(--accent)] font-semibold uppercase mb-0.5">Evidence</p>
            <p className="text-xs text-[var(--muted)]">{finding.evidence}</p>
          </div>
          <p className="text-xs text-white/80 leading-relaxed">{finding.description}</p>
          <div className="bg-[var(--accent)]/8 border border-[var(--accent)]/20 rounded-lg px-3 py-2">
            <p className="text-[0.65rem] text-[var(--accent)] font-semibold uppercase mb-0.5">Action</p>
            <p className="text-xs text-white">{finding.action}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quick prompts ─────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: "Analyze my week", prompt: "Analyze my trading performance this week. What are the biggest patterns you see, both good and bad?" },
  { label: "Worst trade review", prompt: "Look at my recent losing trades and identify what they have in common. What behavioral or technical mistakes am I repeating?" },
  { label: "Position sizing", prompt: "Based on my win rate, average win/loss, and account size, is my current risk per trade optimal? What does Kelly criterion suggest?" },
  { label: "Psychology check", prompt: "Analyze my emotion data and mistake tags. How is my trading psychology impacting my P&L? Give me specific numbers." },
  { label: "Setup edge", prompt: "Which of my setups has the strongest statistical edge? Which should I consider cutting or reducing size on?" },
  { label: "What to fix first", prompt: "If I could fix only one thing about my trading to have the biggest impact on my results, what would it be? Be direct." },
];

// ── Markdown renderer (minimal) ───────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const key = i;
    if (line.startsWith("## ")) return <h2 key={key} className="text-base font-bold text-white mt-3 mb-1">{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={key} className="text-sm font-semibold text-white mt-2 mb-0.5">{line.slice(4)}</h3>;
    if (line.startsWith("# ")) return <h1 key={key} className="text-lg font-bold text-white mt-3 mb-1">{line.slice(2)}</h1>;
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return <li key={key} className="text-sm text-[var(--muted)] ml-4 list-disc" dangerouslySetInnerHTML={{ __html: inlineMd(line.slice(2)) }} />;
    }
    if (/^\d+\.\s/.test(line)) {
      const [num, ...rest] = line.split(/\.\s/, 2);
      return <li key={key} className="text-sm text-[var(--muted)] ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: `${num}. ${inlineMd(rest.join(". "))}` }} />;
    }
    if (line.trim() === "") return <div key={key} className="h-2" />;
    return <p key={key} className="text-sm text-[var(--muted)] leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMd(line) }} />;
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function inlineMd(text: string): string {
  const safe = escapeHtml(text);
  return safe
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-white/80">$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-white/10 text-blue-300 px-1 rounded text-xs font-mono">$1</code>');
}

// ── Typing cursor ─────────────────────────────────────────────────────────────
function Cursor() {
  return <span className="inline-block w-1.5 h-4 bg-[var(--accent)] ml-0.5 animate-pulse align-middle rounded-sm" />;
}

// ── Insight Card Component ────────────────────────────────────────────────────
function InsightCardItem({ card }: { card: InsightCard }) {
  const style = INSIGHT_STYLES[card.type];
  return (
    <div className="rounded-xl p-4 border" style={{ background: style.bg, borderColor: style.border }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${style.badge}`}>
          {style.icon} {card.type}
        </span>
        {card.metric && (
          <span className="text-xs text-[var(--muted)] font-mono shrink-0">{card.metric.label}: <strong className="text-white">{card.metric.value}</strong></span>
        )}
      </div>
      <h4 className="text-sm font-semibold text-white mb-1.5">{card.title}</h4>
      <p className="text-xs text-[var(--muted)] leading-relaxed">{card.content}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AICoachPage() {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [insightRange, setInsightRange] = useState<"week" | "2week" | "month">("week");
  const [leftTab, setLeftTab] = useState<"insights" | "digest">("insights");
  const [generatingDigest, setGeneratingDigest] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const insights = useQuery<InsightsResponse>({
    queryKey: ["ai-insights", insightRange],
    queryFn: () => fetch(`/api/ai/insights?range=${insightRange}`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const digest = useQuery<DigestResponse>({
    queryKey: ["behavioral-digest"],
    queryFn: () => fetch("/api/ai/behavioral-digest").then((r) => r.json()),
    staleTime: 60 * 60 * 1000,
    enabled: leftTab === "digest",
  });

  async function regenerateDigest() {
    setGeneratingDigest(true);
    try {
      await fetch("/api/ai/behavioral-digest?force=1");
      qc.invalidateQueries({ queryKey: ["behavioral-digest"] });
    } finally {
      setGeneratingDigest(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text.trim() };
    const assistantId = crypto.randomUUID();

    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "", streaming: true }]);
    setInput("");
    setStreaming(true);

    abortRef.current = new AbortController();

    try {
      const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: err.error ?? "Something went wrong.", streaming: false } : m));
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m));
      }
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m));
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "Connection error. Please try again.", streaming: false } : m));
      }
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const stopStream = () => { abortRef.current?.abort(); setStreaming(false); };

  const clearChat = () => { setMessages([]); setInput(""); };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* ── Left panel: insights + digest ───────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-[var(--card-border)] flex flex-col bg-[var(--background)] overflow-hidden">
        {/* Tab switcher */}
        <div className="p-3 border-b border-[var(--card-border)]">
          <div className="flex rounded-lg overflow-hidden border border-[var(--card-border)]">
            <button onClick={() => setLeftTab("insights")}
              className={`flex-1 text-xs py-1.5 font-medium transition-colors ${leftTab === "insights" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white"}`}>
              Insights
            </button>
            <button onClick={() => setLeftTab("digest")}
              className={`flex-1 text-xs py-1.5 font-medium transition-colors ${leftTab === "digest" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white"}`}>
              Behavioral Digest
            </button>
          </div>
        </div>

        {/* ── Insights tab ── */}
        {leftTab === "insights" && (
          <>
            <div className="px-4 pt-3 pb-2 border-b border-[var(--card-border)]">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold text-white uppercase tracking-wide">AI Insights</h2>
                <button onClick={() => insights.refetch()} className="text-xs text-[var(--muted)] hover:text-white transition-colors">Refresh</button>
              </div>
              <div className="flex gap-1">
                {([["week", "7d"], ["2week", "14d"], ["month", "30d"]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setInsightRange(v)}
                    className={`flex-1 text-xs py-1 rounded transition-colors ${insightRange === v ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white bg-[var(--card)]"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {insights.isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                </div>
              )}
              {insights.data?.configured === false && (
                <div className="text-center py-6 px-2">
                  <div className="text-2xl mb-2">🔑</div>
                  <p className="text-xs text-[var(--muted)]">Add <code className="bg-white/10 px-1 rounded">ANTHROPIC_API_KEY</code> to enable AI insights.</p>
                </div>
              )}
              {insights.data?.error && <p className="text-xs text-[var(--red)] text-center py-4">{insights.data.error}</p>}
              {insights.data?.insights?.map((card) => <InsightCardItem key={card.id} card={card} />)}
            </div>
            <div className="p-3 border-t border-[var(--card-border)]">
              <p className="text-xs text-[var(--muted)] mb-2 uppercase tracking-wide font-medium">Quick Questions</p>
              <div className="space-y-1">
                {QUICK_PROMPTS.map((q) => (
                  <button key={q.label} onClick={() => { setInput(q.prompt); inputRef.current?.focus(); }}
                    disabled={streaming}
                    className="w-full text-left text-xs text-[var(--muted)] hover:text-white hover:bg-white/5 px-2 py-1.5 rounded transition-colors disabled:opacity-40">
                    {q.label} →
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Behavioral Digest tab ── */}
        {leftTab === "digest" && (
          <>
            <div className="px-4 pt-3 pb-2 border-b border-[var(--card-border)] flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold text-white uppercase tracking-wide">Behavioral Digest</h2>
                <p className="text-[0.65rem] text-[var(--muted)] mt-0.5">28-day behavioral analysis</p>
              </div>
              <button
                onClick={regenerateDigest}
                disabled={generatingDigest || digest.isFetching}
                className="text-xs text-[var(--accent)] hover:opacity-80 disabled:opacity-40 transition-opacity"
              >
                {generatingDigest ? "…" : "Regenerate"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {(digest.isLoading || generatingDigest) && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-6 h-6 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                  <p className="text-xs text-[var(--muted)] text-center">Analyzing 28 days of behavioral data…</p>
                </div>
              )}

              {!digest.isLoading && !generatingDigest && digest.data?.configured === false && (
                <div className="text-center py-6 px-2">
                  <div className="text-2xl mb-2">🔑</div>
                  <p className="text-xs text-[var(--muted)]">Add <code className="bg-white/10 px-1 rounded">ANTHROPIC_API_KEY</code> to enable behavioral analysis.</p>
                </div>
              )}

              {!digest.isLoading && !generatingDigest && digest.data?.message && !digest.data?.digest && (
                <div className="text-center py-8 px-3">
                  <div className="text-3xl mb-3">📊</div>
                  <p className="text-xs text-[var(--muted)]">{digest.data.message}</p>
                </div>
              )}

              {!digest.isLoading && !generatingDigest && digest.data?.digest && (() => {
                const d = digest.data.digest!;
                const findings = d.findings as DigestFinding[];
                const totalImpact = findings.reduce((s, f) => s + f.dollarImpact, 0);
                return (
                  <>
                    {/* Summary card */}
                    <div className="bg-gradient-to-br from-[var(--accent)]/10 to-purple-500/5 border border-[var(--accent)]/25 rounded-xl p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[0.65rem] text-[var(--accent)] font-bold uppercase tracking-wide">Week of {new Date(d.weekOf).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        <span className={`text-xs font-bold ${totalImpact >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                          {totalImpact >= 0 ? "+" : ""}${totalImpact.toLocaleString()} identified
                        </span>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed">{d.summary}</p>
                      <div className="flex gap-3 mt-2.5 pt-2.5 border-t border-white/10">
                        <div className="text-center">
                          <p className="text-sm font-bold text-white">{d.tradeCount}</p>
                          <p className="text-[0.6rem] text-[var(--muted)]">trades</p>
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-bold ${d.netPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>${Math.round(d.netPnl).toLocaleString()}</p>
                          <p className="text-[0.6rem] text-[var(--muted)]">net P&L</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-[var(--red)]">{findings.filter((f) => f.severity === "high").length}</p>
                          <p className="text-[0.6rem] text-[var(--muted)]">high severity</p>
                        </div>
                      </div>
                    </div>

                    {/* Findings */}
                    {findings.map((f) => <DigestFindingCard key={f.id} finding={f} />)}

                    {digest.data?.cached && (
                      <p className="text-[0.6rem] text-[var(--muted)] text-center">
                        Cached digest · Generated {new Date(d.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        )}
      </aside>

      {/* ── Main chat area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--card-border)] shrink-0">
          <div>
            <h1 className="text-base font-bold text-white">AI Coach</h1>
            <p className="text-xs text-[var(--muted)]">Ask anything about your trading performance</p>
          </div>
          {messages.length > 0 && (
            <button onClick={clearChat} className="text-xs text-[var(--muted)] hover:text-white transition-colors px-3 py-1.5 rounded border border-[var(--card-border)] hover:border-white/30">
              Clear chat
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-[var(--accent)]/20 border border-[var(--accent)]/30 flex items-center justify-center text-2xl mb-4">
                ◈
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Your AI Trading Coach</h2>
              <p className="text-sm text-[var(--muted)] mb-6">
                I have full context of your trade history, setups, emotion data, and performance stats. Ask me anything.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full">
                {QUICK_PROMPTS.slice(0, 4).map((q) => (
                  <button key={q.label} onClick={() => sendMessage(q.prompt)}
                    className="text-xs text-left bg-[var(--card)] border border-[var(--card-border)] hover:border-[var(--accent)]/50 rounded-lg px-3 py-2.5 text-[var(--muted)] hover:text-white transition-colors">
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/20 border border-[var(--accent)]/30 flex items-center justify-center text-xs shrink-0 mt-0.5">◈</div>
              )}
              <div className={`max-w-[78%] ${msg.role === "user" ? "bg-[var(--accent)] text-white rounded-2xl rounded-tr-sm px-4 py-2.5" : "bg-[var(--card)] border border-[var(--card-border)] rounded-2xl rounded-tl-sm px-4 py-3"}`}>
                {msg.role === "user" ? (
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                ) : (
                  <div className="space-y-0.5">
                    {renderMarkdown(msg.content)}
                    {msg.streaming && <Cursor />}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs shrink-0 mt-0.5">U</div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="shrink-0 px-5 py-4 border-t border-[var(--card-border)]">
          {insights.data?.configured === false && (
            <div className="mb-3 text-xs text-center text-[var(--muted)] bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2">
              AI not configured. Add <code className="bg-white/10 px-1 rounded">ANTHROPIC_API_KEY</code> to <code className="bg-white/10 px-1 rounded">.env</code> to enable chat.
            </div>
          )}
          <div className="flex gap-3 items-end">
            <div className="flex-1 bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden focus-within:border-[var(--accent)]/50 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your trading performance…"
                disabled={streaming || insights.data?.configured === false}
                rows={1}
                style={{ resize: "none", minHeight: "44px", maxHeight: "140px" }}
                className="w-full bg-transparent text-white placeholder:text-[var(--muted)] text-sm px-4 py-3 outline-none disabled:opacity-50"
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
                }}
              />
            </div>
            {streaming ? (
              <button onClick={stopStream}
                className="h-11 px-4 rounded-xl bg-[var(--red-dim)] border border-[var(--red)]/30 text-[var(--red)] text-sm font-medium hover:bg-[var(--red)]/20 transition-colors shrink-0">
                Stop
              </button>
            ) : (
              <button onClick={() => sendMessage(input)}
                disabled={!input.trim() || insights.data?.configured === false}
                className="h-11 px-5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0">
                Send
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--muted)] mt-2 text-center">
            Enter to send · Shift+Enter for new line · Context: last 60 days of trades
          </p>
        </div>
      </div>
    </div>
  );
}
