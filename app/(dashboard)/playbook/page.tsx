"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────
type AssetClass = "STOCK" | "OPTION" | "FUTURE" | "FOREX" | "CRYPTO" | "COMMODITY";
type RuleCategory = "ENTRY" | "EXIT" | "RISK" | "PSYCHOLOGY" | "MISC";

interface PlaybookStats { tradeCount: number; winners: number; winRate: number; netPnl: number; avgR: number; adherence: number | null; }
interface Playbook {
  id: string; name: string; description: string | null; setupType: string | null;
  assetClass: AssetClass[]; timeframes: string[]; tags: string[]; isActive: boolean;
  entryRules: string | null; exitRules: string | null; riskRules: string | null;
  createdAt: string; updatedAt: string; stats: PlaybookStats;
}
interface PlaybookDetail extends Playbook {
  stats: PlaybookStats & { losers: number; avgWin: number; avgLoss: number; profitFactor: number; topBrokenRules: { rule: string; count: number }[] };
  equityCurve: { date: string; cumulative: number }[];
  recentTrades: { id: string; symbol: string; side: string; netPnl: number; rRatio: number | null; entryTime: string; rulesFollowed: boolean | null; rulesBroken: string[] }[];
}
interface Rule { id: string; text: string; category: RuleCategory; isActive: boolean; violationCount: number; order: number; }

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) => `${v >= 0 ? "" : "-"}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const pnlColor = (v: number) => (v >= 0 ? "var(--green)" : "var(--red)");

const RULE_CATEGORIES: RuleCategory[] = ["ENTRY", "EXIT", "RISK", "PSYCHOLOGY", "MISC"];
const CAT_COLORS: Record<RuleCategory, string> = {
  ENTRY: "text-blue-400 bg-blue-500/10",
  EXIT: "text-purple-400 bg-purple-500/10",
  RISK: "text-[var(--red)] bg-[var(--red-dim)]",
  PSYCHOLOGY: "text-yellow-400 bg-yellow-500/10",
  MISC: "text-[var(--muted)] bg-white/5",
};
const ASSET_LABELS: Record<AssetClass, string> = { STOCK: "Stocks", OPTION: "Options", FUTURE: "Futures", FOREX: "Forex", CRYPTO: "Crypto", COMMODITY: "Commodity" };
const TIMEFRAMES = ["1m", "2m", "5m", "15m", "30m", "1h", "4h", "1D", "1W"];
const ALL_ASSETS: AssetClass[] = ["STOCK", "OPTION", "FUTURE", "FOREX", "CRYPTO", "COMMODITY"];

// ── Playbook Form Modal ───────────────────────────────────────────────────────
function PlaybookModal({ initial, onClose, onSaved }: {
  initial?: Partial<Playbook>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [setupType, setSetupType] = useState(initial?.setupType ?? "");
  const [assetClass, setAssetClass] = useState<AssetClass[]>(initial?.assetClass ?? []);
  const [timeframes, setTimeframes] = useState<string[]>(initial?.timeframes ?? []);
  const [entryRules, setEntryRules] = useState(initial?.entryRules ?? "");
  const [exitRules, setExitRules] = useState(initial?.exitRules ?? "");
  const [riskRules, setRiskRules] = useState(initial?.riskRules ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const toggle = <T,>(arr: T[], val: T): T[] => arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const save = async () => {
    if (!name.trim()) { setErr("Name is required"); return; }
    setSaving(true); setErr("");
    const body = {
      name, description: description || null, setupType: setupType || null,
      assetClass, timeframes, entryRules: entryRules || null, exitRules: exitRules || null,
      riskRules: riskRules || null, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), isActive,
    };
    try {
      const res = await fetch(isEdit ? `/api/playbook/${initial.id}` : "/api/playbook", {
        method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved(); onClose();
    } catch (e: unknown) { setErr((e as Error).message); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[var(--card-border)]">
          <h2 className="text-lg font-bold text-white">{isEdit ? "Edit Playbook" : "New Playbook"}</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Name + active */}
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <label className="text-xs text-[var(--muted)] block mb-1">Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VWAP Reclaim" className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[var(--accent)]/50" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Active</label>
              <button onClick={() => setIsActive(!isActive)} className={`mt-0.5 w-12 h-6 rounded-full transition-colors ${isActive ? "bg-[var(--accent)]" : "bg-white/10"}`}>
                <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${isActive ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>
          </div>

          {/* Setup type + description */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Setup Type</label>
              <input value={setupType} onChange={(e) => setSetupType(e.target.value)} placeholder="e.g. Breakout, VWAP, Gap-and-Go" className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[var(--accent)]/50" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Tags (comma-separated)</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="momentum, premarket" className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[var(--accent)]/50" />
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Brief overview of this setup..." className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[var(--accent)]/50 resize-none" />
          </div>

          {/* Asset classes */}
          <div>
            <label className="text-xs text-[var(--muted)] block mb-2">Asset Classes</label>
            <div className="flex flex-wrap gap-2">
              {ALL_ASSETS.map((a) => (
                <button key={a} onClick={() => setAssetClass(toggle(assetClass, a))}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${assetClass.includes(a) ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--card-border)] text-[var(--muted)] hover:text-white"}`}>
                  {ASSET_LABELS[a]}
                </button>
              ))}
            </div>
          </div>

          {/* Timeframes */}
          <div>
            <label className="text-xs text-[var(--muted)] block mb-2">Timeframes</label>
            <div className="flex flex-wrap gap-2">
              {TIMEFRAMES.map((tf) => (
                <button key={tf} onClick={() => setTimeframes(toggle(timeframes, tf))}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${timeframes.includes(tf) ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--card-border)] text-[var(--muted)] hover:text-white"}`}>
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Rules */}
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">Entry Rules</label>
            <textarea value={entryRules} onChange={(e) => setEntryRules(e.target.value)} rows={3} placeholder="• Price must be above VWAP&#10;• Volume spike on entry bar&#10;• Risk:reward ≥ 2:1" className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[var(--accent)]/50 resize-none font-mono" />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">Exit Rules</label>
            <textarea value={exitRules} onChange={(e) => setExitRules(e.target.value)} rows={3} placeholder="• Scale out 50% at 1R&#10;• Move stop to breakeven at 1R&#10;• Full exit at target or EOD" className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[var(--accent)]/50 resize-none font-mono" />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">Risk Rules</label>
            <textarea value={riskRules} onChange={(e) => setRiskRules(e.target.value)} rows={2} placeholder="• Max 1% account risk per trade&#10;• Max 2 trades per session" className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[var(--accent)]/50 resize-none font-mono" />
          </div>

          {err && <p className="text-[var(--red)] text-sm">{err}</p>}
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-[var(--card-border)]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--muted)] hover:text-white transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 text-sm bg-[var(--accent)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Playbook"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Playbook Detail Panel ─────────────────────────────────────────────────────
function PlaybookDetailPanel({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (pb: Playbook) => void }) {
  const { data, isLoading } = useQuery<PlaybookDetail>({
    queryKey: ["playbook-detail", id],
    queryFn: () => fetch(`/api/playbook/${id}`).then((r) => r.json()),
  });

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" /></div>
  );
  if (!data) return null;

  const s = data.stats;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-[var(--card-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-white">{data.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${data.isActive ? "bg-[var(--green-dim)] text-[var(--green)]" : "bg-white/5 text-[var(--muted)]"}`}>{data.isActive ? "Active" : "Inactive"}</span>
          </div>
          {data.description && <p className="text-sm text-[var(--muted)]">{data.description}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {data.setupType && <span className="text-xs bg-[var(--accent)]/20 text-[var(--accent)] px-2 py-0.5 rounded-full">{data.setupType}</span>}
            {data.assetClass.map((a) => <span key={a} className="text-xs bg-white/5 text-[var(--muted)] px-2 py-0.5 rounded-full">{ASSET_LABELS[a]}</span>)}
            {data.timeframes.map((tf) => <span key={tf} className="text-xs bg-white/5 text-[var(--muted)] px-2 py-0.5 rounded-full">{tf}</span>)}
            {data.tags.map((t) => <span key={t} className="text-xs bg-white/5 text-[var(--muted)] px-2 py-0.5 rounded-full">#{t}</span>)}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => onEdit(data)} className="text-xs px-3 py-1.5 border border-[var(--card-border)] text-[var(--muted)] hover:text-white rounded-lg transition-colors">Edit</button>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-white text-xl leading-none px-2">×</button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Stats grid */}
        {s.tradeCount > 0 ? (
          <>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: "Trades", value: String(s.tradeCount) },
                { label: "Win Rate", value: fmtPct(s.winRate), color: s.winRate >= 50 ? "var(--green)" : "var(--red)" },
                { label: "Net P&L", value: fmt(s.netPnl), color: pnlColor(s.netPnl) },
                { label: "Profit Factor", value: s.profitFactor.toFixed(2), color: s.profitFactor >= 1.5 ? "var(--green)" : s.profitFactor >= 1 ? "white" : "var(--red)" },
                { label: "Avg R", value: `${s.avgR.toFixed(2)}R`, color: pnlColor(s.avgR) },
                { label: "Rule Adherence", value: s.adherence != null ? fmtPct(s.adherence) : "—", color: s.adherence != null ? (s.adherence >= 80 ? "var(--green)" : s.adherence >= 60 ? "white" : "var(--red)") : undefined },
              ].map((item) => (
                <div key={item.label} className="bg-[var(--background)] rounded-xl p-3 border border-[var(--card-border)]">
                  <p className="text-xs text-[var(--muted)] mb-1">{item.label}</p>
                  <p className="text-base font-bold" style={{ color: item.color ?? "white" }}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Equity curve */}
            {data.equityCurve.length > 1 && (
              <div>
                <p className="text-xs text-[var(--muted)] uppercase tracking-wide font-semibold mb-2">Equity Curve</p>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={data.equityCurve} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <defs><linearGradient id="pbEqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} /><stop offset="95%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 9 }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "var(--muted)", fontSize: 9 }} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: unknown) => [fmt(v as number), "P&L"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
                    <ReferenceLine y={0} stroke="var(--card-border)" />
                    <Area type="monotone" dataKey="cumulative" stroke="var(--accent)" fill="url(#pbEqGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top broken rules */}
            {s.topBrokenRules.length > 0 && (
              <div>
                <p className="text-xs text-[var(--muted)] uppercase tracking-wide font-semibold mb-2">Top Broken Rules</p>
                <div className="space-y-1.5">
                  {s.topBrokenRules.map(({ rule, count }) => (
                    <div key={rule} className="flex items-center justify-between bg-[var(--red-dim)] border border-[var(--red)]/20 rounded-lg px-3 py-2">
                      <span className="text-sm text-white">{rule}</span>
                      <span className="text-xs font-bold text-[var(--red)]">{count}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent trades */}
            {data.recentTrades.length > 0 && (
              <div>
                <p className="text-xs text-[var(--muted)] uppercase tracking-wide font-semibold mb-2">Recent Trades</p>
                <div className="space-y-1.5">
                  {data.recentTrades.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2">
                      <span className="font-semibold text-sm text-white w-16 shrink-0">{t.symbol}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${t.side === "LONG" ? "bg-[var(--green-dim)] text-[var(--green)]" : "bg-[var(--red-dim)] text-[var(--red)]"}`}>{t.side}</span>
                      <span className="text-sm font-mono flex-1" style={{ color: pnlColor(t.netPnl) }}>{fmt(t.netPnl)}</span>
                      {t.rRatio != null && <span className="text-xs text-[var(--muted)] font-mono">{t.rRatio.toFixed(2)}R</span>}
                      {t.rulesFollowed != null && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${t.rulesFollowed ? "bg-[var(--green-dim)] text-[var(--green)]" : "bg-[var(--red-dim)] text-[var(--red)]"}`}>
                          {t.rulesFollowed ? "✓" : "✗"}
                        </span>
                      )}
                      <span className="text-xs text-[var(--muted)]">{new Date(t.entryTime).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6 text-[var(--muted)] text-sm">
            No trades linked to this playbook yet. When logging trades, assign them to this playbook to track performance.
          </div>
        )}

        {/* Setup rules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[["Entry Rules", data.entryRules, "blue"], ["Exit Rules", data.exitRules, "purple"], ["Risk Rules", data.riskRules, "red"]].map(([label, content, color]) => (
            content && (
              <div key={label as string} className="bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: color === "blue" ? "#60a5fa" : color === "purple" ? "#a78bfa" : "var(--red)" }}>{label as string}</p>
                <pre className="text-xs text-[var(--muted)] whitespace-pre-wrap font-mono leading-relaxed">{content as string}</pre>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Rules Tab ─────────────────────────────────────────────────────────────────
function RulesTab({ rules, onRefresh }: { rules: Rule[]; onRefresh: () => void }) {
  const [addingCat, setAddingCat] = useState<RuleCategory | null>(null);
  const [newText, setNewText] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const addRule = async (cat: RuleCategory) => {
    if (!newText.trim()) return;
    await fetch("/api/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: newText.trim(), category: cat }) });
    setNewText(""); setAddingCat(null); onRefresh();
  };

  const toggleActive = async (rule: Rule) => {
    await fetch(`/api/rules/${rule.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !rule.isActive }) });
    onRefresh();
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    await fetch(`/api/rules/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: editText.trim() }) });
    setEditId(null); onRefresh();
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    onRefresh();
  };

  const activeRules = rules.filter((r) => r.isActive);
  const totalViolations = rules.reduce((s, r) => s + r.violationCount, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
          <p className="text-xs text-[var(--muted)] mb-1">Active Rules</p>
          <p className="text-2xl font-bold text-white">{activeRules.length} <span className="text-sm text-[var(--muted)]">/ {rules.length}</span></p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
          <p className="text-xs text-[var(--muted)] mb-1">Total Violations</p>
          <p className="text-2xl font-bold" style={{ color: totalViolations > 0 ? "var(--red)" : "var(--green)" }}>{totalViolations}</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
          <p className="text-xs text-[var(--muted)] mb-1">Categories</p>
          <p className="text-2xl font-bold text-white">{RULE_CATEGORIES.filter((c) => rules.some((r) => r.category === c)).length}</p>
        </div>
      </div>

      {/* By category */}
      {RULE_CATEGORIES.map((cat) => {
        const catRules = rules.filter((r) => r.category === cat);
        const isAdding = addingCat === cat;
        return (
          <div key={cat} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CAT_COLORS[cat]}`}>{cat}</span>
                <span className="text-xs text-[var(--muted)]">{catRules.length} rules</span>
              </div>
              <button onClick={() => { setAddingCat(cat); setNewText(""); setTimeout(() => addInputRef.current?.focus(), 50); }}
                className="text-xs text-[var(--accent)] hover:opacity-80 transition-opacity">+ Add</button>
            </div>

            <div className="divide-y divide-[var(--card-border)]">
              {catRules.length === 0 && !isAdding && (
                <p className="text-xs text-[var(--muted)] px-4 py-3 italic">No {cat.toLowerCase()} rules yet.</p>
              )}
              {catRules.map((rule) => (
                <div key={rule.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors ${!rule.isActive ? "opacity-50" : ""}`}>
                  <button onClick={() => toggleActive(rule)}
                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${rule.isActive ? "bg-[var(--accent)] border-[var(--accent)]" : "border-white/20 bg-transparent"}`}>
                    {rule.isActive && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
                  </button>
                  {editId === rule.id ? (
                    <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(rule.id); if (e.key === "Escape") setEditId(null); }}
                      className="flex-1 bg-[var(--background)] border border-[var(--card-border)] rounded px-2 py-1 text-white text-sm outline-none focus:border-[var(--accent)]/50" />
                  ) : (
                    <span className="flex-1 text-sm text-white">{rule.text}</span>
                  )}
                  {rule.violationCount > 0 && (
                    <span className="text-xs bg-[var(--red-dim)] text-[var(--red)] px-1.5 py-0.5 rounded-full font-medium shrink-0">{rule.violationCount}x</span>
                  )}
                  <div className="flex gap-1 shrink-0">
                    {editId === rule.id ? (
                      <>
                        <button onClick={() => saveEdit(rule.id)} className="text-xs text-[var(--green)] hover:opacity-80 px-1">Save</button>
                        <button onClick={() => setEditId(null)} className="text-xs text-[var(--muted)] hover:text-white px-1">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditId(rule.id); setEditText(rule.text); }} className="text-xs text-[var(--muted)] hover:text-white px-1 transition-colors">Edit</button>
                        <button onClick={() => deleteRule(rule.id)} className="text-xs text-[var(--muted)] hover:text-[var(--red)] px-1 transition-colors">Del</button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {isAdding && (
                <div className="flex items-center gap-3 px-4 py-3 bg-[var(--background)]">
                  <div className="w-4 h-4 shrink-0" />
                  <input ref={addInputRef} value={newText} onChange={(e) => setNewText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addRule(cat); if (e.key === "Escape") setAddingCat(null); }}
                    placeholder="Type rule text… (Enter to save)"
                    className="flex-1 bg-[var(--card)] border border-[var(--accent)]/50 rounded px-2 py-1 text-white text-sm outline-none" />
                  <button onClick={() => addRule(cat)} className="text-xs text-[var(--green)] hover:opacity-80 px-1">Save</button>
                  <button onClick={() => setAddingCat(null)} className="text-xs text-[var(--muted)] hover:text-white px-1">Cancel</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PlaybookPage() {
  const [tab, setTab] = useState<"playbooks" | "rules">("playbooks");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Partial<Playbook> | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);
  const qc = useQueryClient();

  const playbooks = useQuery<Playbook[]>({ queryKey: ["playbooks"], queryFn: () => fetch("/api/playbook").then((r) => r.json()) });
  const rules = useQuery<Rule[]>({ queryKey: ["rules"], queryFn: () => fetch("/api/rules").then((r) => r.json()) });

  const deletePlaybook = useMutation({
    mutationFn: (id: string) => fetch(`/api/playbook/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["playbooks"] }); if (selectedId === deleting) setSelectedId(null); setDeleting(null); },
  });

  const openCreate = () => { setEditTarget(undefined); setModalOpen(true); };
  const openEdit = (pb: Partial<Playbook>) => { setEditTarget(pb); setModalOpen(true); };
  const saved = () => { qc.invalidateQueries({ queryKey: ["playbooks"] }); if (editTarget?.id) qc.invalidateQueries({ queryKey: ["playbook-detail", editTarget.id] }); };

  const pbList = playbooks.data ?? [];
  const selected = pbList.find((p) => p.id === selectedId);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Playbook</h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">Document your setups and trading rules</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity">
          + New Playbook
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--card-border)]">
        {(["playbooks", "rules"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px capitalize ${tab === t ? "border-[var(--accent)] text-white" : "border-transparent text-[var(--muted)] hover:text-white"}`}>
            {t === "playbooks" ? `Playbooks (${pbList.length})` : `Trading Rules (${(rules.data ?? []).filter((r) => r.isActive).length} active)`}
          </button>
        ))}
      </div>

      {/* Playbooks tab */}
      {tab === "playbooks" && (
        <div className={`flex gap-5 ${selectedId ? "items-start" : ""}`}>
          {/* Grid */}
          <div className={`${selectedId ? "w-80 shrink-0" : "flex-1"}`}>
            {playbooks.isLoading && (
              <div className="flex items-center justify-center h-32"><div className="w-6 h-6 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" /></div>
            )}
            {!playbooks.isLoading && pbList.length === 0 && (
              <div className="text-center py-16 border border-dashed border-[var(--card-border)] rounded-2xl">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-white font-semibold mb-1">No playbooks yet</p>
                <p className="text-[var(--muted)] text-sm mb-4">Document your trading setups to track which ones have real edge.</p>
                <button onClick={openCreate} className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90">Create your first playbook</button>
              </div>
            )}
            <div className={`${selectedId ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}`}>
              {pbList.map((pb) => {
                const isSelected = pb.id === selectedId;
                const s = pb.stats;
                return (
                  <div key={pb.id}
                    onClick={() => setSelectedId(isSelected ? null : pb.id)}
                    className={`bg-[var(--card)] border rounded-xl p-4 cursor-pointer transition-all hover:border-[var(--accent)]/40 ${isSelected ? "border-[var(--accent)]/60" : "border-[var(--card-border)]"}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-white text-sm leading-tight">{pb.name}</h3>
                        {pb.setupType && <p className="text-xs text-[var(--accent)] mt-0.5">{pb.setupType}</p>}
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${pb.isActive ? "bg-[var(--green-dim)] text-[var(--green)]" : "bg-white/5 text-[var(--muted)]"}`}>
                        {pb.isActive ? "Active" : "Off"}
                      </span>
                    </div>
                    {pb.description && !selectedId && <p className="text-xs text-[var(--muted)] mb-3 line-clamp-2">{pb.description}</p>}
                    {s.tradeCount > 0 ? (
                      <div className={`grid gap-2 mt-2 ${selectedId ? "grid-cols-2" : "grid-cols-3"}`}>
                        <div><p className="text-xs text-[var(--muted)]">Trades</p><p className="text-sm font-semibold text-white">{s.tradeCount}</p></div>
                        <div><p className="text-xs text-[var(--muted)]">Win Rate</p><p className="text-sm font-semibold" style={{ color: s.winRate >= 50 ? "var(--green)" : "var(--red)" }}>{fmtPct(s.winRate)}</p></div>
                        {!selectedId && <div><p className="text-xs text-[var(--muted)]">Net P&L</p><p className="text-sm font-semibold font-mono" style={{ color: pnlColor(s.netPnl) }}>{fmt(s.netPnl)}</p></div>}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--muted)] italic mt-1">No trades yet</p>
                    )}
                    {!selectedId && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {pb.assetClass.map((a) => <span key={a} className="text-xs bg-white/5 text-[var(--muted)] px-1.5 py-0.5 rounded">{ASSET_LABELS[a]}</span>)}
                        {pb.timeframes.map((tf) => <span key={tf} className="text-xs bg-white/5 text-[var(--muted)] px-1.5 py-0.5 rounded">{tf}</span>)}
                      </div>
                    )}
                    {!selectedId && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--card-border)]">
                        <button onClick={(e) => { e.stopPropagation(); openEdit(pb); }} className="text-xs text-[var(--muted)] hover:text-white transition-colors">Edit</button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleting(pb.id); if (confirm(`Delete "${pb.name}"?`)) deletePlaybook.mutate(pb.id); }} className="text-xs text-[var(--muted)] hover:text-[var(--red)] transition-colors">Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail panel */}
          {selectedId && (
            <div className="flex-1 bg-[var(--card)] border border-[var(--card-border)] rounded-2xl flex flex-col overflow-hidden min-h-0">
              <PlaybookDetailPanel
                id={selectedId}
                onClose={() => setSelectedId(null)}
                onEdit={(pb) => openEdit(pb)}
              />
            </div>
          )}
        </div>
      )}

      {/* Rules tab */}
      {tab === "rules" && rules.data && (
        <RulesTab rules={rules.data} onRefresh={() => qc.invalidateQueries({ queryKey: ["rules"] })} />
      )}

      {/* Modal */}
      {modalOpen && (
        <PlaybookModal
          initial={editTarget}
          onClose={() => setModalOpen(false)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
