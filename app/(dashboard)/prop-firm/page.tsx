"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trophy, AlertTriangle, CheckCircle, XCircle, Trash2, Building2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Challenge {
  id: string; firm: string; phase: string; status: string;
  accountSize: number; maxDailyLossPct: number; maxTotalDrawdownPct: number;
  profitTargetPct: number; minTradingDays: number | null; isTrailingDrawdown: boolean;
  startDate: string; endDate: string | null; accountId: string | null;
  currentEquity: number; highWaterMark: number; tradingDaysCount: number; notes: string | null;
  todayPnl: number; totalPnl: number; drawdownFromPeak: number;
}

const FIRMS = ["FTMO", "MyFundedFX", "Topstep", "The5ers", "FundedNext", "Apex", "TradeDay", "Other"];
const PHASES = ["challenge", "verification", "funded"];
const STATUS_COLORS: Record<string, string> = {
  active: "text-[var(--green)] bg-[var(--green-dim)]",
  passed: "text-blue-400 bg-blue-500/10",
  failed: "text-[var(--red)] bg-[var(--red-dim)]",
  suspended: "text-yellow-400 bg-yellow-500/10",
};

// ── Gauge ─────────────────────────────────────────────────────────────────────
function Gauge({ pct, danger, label, value }: { pct: number; danger?: boolean; label: string; value: string }) {
  const capped = Math.min(pct, 100);
  const color = capped >= 90 ? "var(--red)" : capped >= 70 ? "#f59e0b" : danger ? "var(--red)" : "var(--green)";
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (capped / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg width="64" height="64" className="-rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--card-border)" strokeWidth="5" />
          <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold text-white">{capped.toFixed(0)}%</span>
        </div>
      </div>
      <p className="text-[10px] text-[var(--muted)] text-center leading-tight">{label}</p>
      <p className="text-xs font-semibold text-white">{value}</p>
    </div>
  );
}

// ── Challenge Card ────────────────────────────────────────────────────────────
function ChallengeCard({ c, onDelete }: { c: Challenge; onDelete: (id: string) => void }) {
  const fmt = (v: number) => `${v >= 0 ? "" : "-"}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

  const maxDailyLoss = (c.accountSize * c.maxDailyLossPct) / 100;
  const maxDrawdown  = (c.accountSize * c.maxTotalDrawdownPct) / 100;
  const profitTarget = (c.accountSize * c.profitTargetPct) / 100;

  const dailyLossUsed = c.todayPnl < 0 ? (Math.abs(c.todayPnl) / maxDailyLoss) * 100 : 0;
  const drawdownUsed  = (c.drawdownFromPeak / maxDrawdown) * 100;
  const profitReached = Math.max(0, (c.totalPnl / profitTarget) * 100);

  const isAtRisk = dailyLossUsed >= 70 || drawdownUsed >= 70;
  const isDanger = dailyLossUsed >= 90 || drawdownUsed >= 90;

  const StatusIcon = c.status === "passed" ? CheckCircle : c.status === "failed" ? XCircle : isDanger ? AlertTriangle : null;

  return (
    <div className={cn(
      "bg-[var(--card)] border rounded-xl p-5 space-y-4",
      isDanger ? "border-[var(--red)]" : isAtRisk ? "border-yellow-500/40" : "border-[var(--card-border)]"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={14} className="text-[var(--accent)]" />
            <span className="font-bold text-white text-base">{c.firm}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] capitalize">{c.phase}</span>
          </div>
          <p className="text-[var(--muted)] text-xs">Started {format(new Date(c.startDate), "MMM d, yyyy")}
            {c.endDate && ` · Ends ${format(new Date(c.endDate), "MMM d")}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {StatusIcon && <StatusIcon size={16} className={c.status === "passed" ? "text-blue-400" : "text-[var(--red)]"} />}
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[c.status] ?? "text-[var(--muted)] bg-[var(--card-border)]")}>
            {c.status}
          </span>
          <button onClick={() => onDelete(c.id)} className="p-1 text-[var(--muted)] hover:text-[var(--red)] transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Account size */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><p className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Account</p><p className="text-white font-bold">{fmt(c.accountSize)}</p></div>
        <div><p className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Current Equity</p><p className={cn("font-bold", c.totalPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>{fmt(c.currentEquity ?? c.accountSize + c.totalPnl)}</p></div>
        <div><p className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Today P&L</p><p className={cn("font-bold", c.todayPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>{fmt(c.todayPnl)}</p></div>
      </div>

      {/* Gauges */}
      <div className="flex items-center justify-around py-2">
        <Gauge pct={dailyLossUsed} danger label="Daily Loss Used" value={`${fmt(Math.abs(c.todayPnl))} / ${fmt(maxDailyLoss)}`} />
        <Gauge pct={drawdownUsed} danger label={c.isTrailingDrawdown ? "Trailing DD" : "Max Drawdown"} value={`${fmt(c.drawdownFromPeak)} / ${fmt(maxDrawdown)}`} />
        <Gauge pct={profitReached} label="Profit Target" value={`${fmt(Math.max(0, c.totalPnl))} / ${fmt(profitTarget)}`} />
        {c.minTradingDays && <Gauge pct={(c.tradingDaysCount / c.minTradingDays) * 100} label="Trading Days" value={`${c.tradingDaysCount} / ${c.minTradingDays}`} />}
      </div>

      {/* Risk bars */}
      <div className="space-y-2">
        {[
          { label: "Daily Loss Limit", used: dailyLossUsed, left: fmt(maxDailyLoss - Math.abs(Math.min(c.todayPnl, 0))) },
          { label: "Max Drawdown", used: drawdownUsed, left: fmt(maxDrawdown - c.drawdownFromPeak) },
        ].map(({ label, used, left }) => (
          <div key={label}>
            <div className="flex justify-between text-[10px] text-[var(--muted)] mb-1">
              <span>{label}</span><span>{left} remaining</span>
            </div>
            <div className="h-1.5 bg-[var(--card-border)] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(used, 100)}%`, background: used >= 90 ? "var(--red)" : used >= 70 ? "#f59e0b" : "var(--green)" }} />
            </div>
          </div>
        ))}
      </div>

      {isDanger && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--red-dim)] rounded-lg border border-[var(--red)]/30">
          <AlertTriangle size={13} className="text-[var(--red)] shrink-0" />
          <p className="text-[var(--red)] text-xs font-medium">Approaching limit — stop trading for today to protect your account.</p>
        </div>
      )}
    </div>
  );
}

// ── New Challenge Form ────────────────────────────────────────────────────────
function NewChallengeForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firm: "FTMO", phase: "challenge", accountSize: 100000,
    maxDailyLossPct: 5, maxTotalDrawdownPct: 10, profitTargetPct: 10,
    minTradingDays: 10, isTrailingDrawdown: false,
    startDate: new Date().toISOString().split("T")[0], endDate: "", notes: "",
  });
  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => fetch("/api/accounts").then((r) => r.json()),
  });

  const [accountId, setAccountId] = useState("");

  const mutation = useMutation({
    mutationFn: (data: typeof form & { accountId: string }) =>
      fetch("/api/prop-challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prop-challenges"] }); onClose(); },
  });

  const inputCls = "w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--accent)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-lg font-bold text-white mb-5">Add Prop Challenge</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1.5">Firm</label>
              <select value={form.firm} onChange={(e) => set("firm", e.target.value)} className={inputCls}>
                {FIRMS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1.5">Phase</label>
              <select value={form.phase} onChange={(e) => set("phase", e.target.value)} className={inputCls}>
                {PHASES.map((p) => <option key={p} className="capitalize">{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5">Account Size ($)</label>
            <input type="number" value={form.accountSize} onChange={(e) => set("accountSize", Number(e.target.value))} className={inputCls} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "maxDailyLossPct", label: "Max Daily Loss (%)" },
              { key: "maxTotalDrawdownPct", label: "Max Drawdown (%)" },
              { key: "profitTargetPct", label: "Profit Target (%)" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-[var(--muted)] mb-1.5">{label}</label>
                <input type="number" step="0.5" value={(form as Record<string, unknown>)[key] as number}
                  onChange={(e) => set(key, Number(e.target.value))} className={inputCls} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1.5">Min Trading Days</label>
              <input type="number" value={form.minTradingDays} onChange={(e) => set("minTradingDays", Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1.5">Link Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
                <option value="">— None —</option>
                {(accounts as { id: string; name: string }[]).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1.5">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1.5">Deadline (optional)</label>
              <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="trailing" checked={form.isTrailingDrawdown}
              onChange={(e) => set("isTrailingDrawdown", e.target.checked)}
              className="w-4 h-4 accent-[var(--accent)]" />
            <label htmlFor="trailing" className="text-sm text-[var(--muted)]">Trailing drawdown (like Topstep / FTMO funded)</label>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-[var(--card-border)] text-[var(--muted)] rounded-lg text-sm hover:text-white transition-colors">Cancel</button>
          <button onClick={() => mutation.mutate({ ...form, accountId })} disabled={mutation.isPending}
            className="flex-1 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {mutation.isPending ? "Adding…" : "Add Challenge"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PropFirmPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: challenges = [], isLoading } = useQuery<Challenge[]>({
    queryKey: ["prop-challenges"],
    queryFn: () => fetch("/api/prop-challenges").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/prop-challenges/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prop-challenges"] }),
  });

  const active = challenges.filter((c) => c.status === "active");
  const archived = challenges.filter((c) => c.status !== "active");

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Prop Firm</h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">Track your challenges, stay within limits, get funded</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors">
          <Plus size={15} /> Add Challenge
        </button>
      </div>

      {/* Active challenges */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Trophy size={40} className="text-[var(--muted)] mb-4" />
          <p className="text-white font-semibold mb-1">No active challenges</p>
          <p className="text-[var(--muted)] text-sm mb-5">Add a prop firm challenge to track your limits and progress</p>
          <button onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-lg">
            Add Challenge
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {active.map((c) => <ChallengeCard key={c.id} c={c} onDelete={(id) => deleteMutation.mutate(id)} />)}
        </div>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Archived</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 opacity-60">
            {archived.map((c) => <ChallengeCard key={c.id} c={c} onDelete={(id) => deleteMutation.mutate(id)} />)}
          </div>
        </div>
      )}

      {showForm && <NewChallengeForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
