"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PushNotificationToggle } from "@/components/shared/PushNotificationToggle";

// ── Types ────────────────────────────────────────────────────────────────────
type AccountType = "LIVE" | "PAPER" | "BACKTEST";
interface UserSettings {
  id: string; name: string | null; email: string; image: string | null;
  timezone: string; currency: string; accountSize: number; riskPerTrade: number;
  aiModel: string; aiConfigured: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
}
interface Account {
  id: string; name: string; broker: string | null; accountNumber: string | null;
  accountType: AccountType; isDefault: boolean; isActive: boolean;
  currency: string; initialBalance: number; currentBalance: number;
  commission: number; commissionType: string;
  _count: { trades: number };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TIMEZONES = [
  { label: "Eastern Time (ET)", value: "America/New_York" },
  { label: "Central Time (CT)", value: "America/Chicago" },
  { label: "Mountain Time (MT)", value: "America/Denver" },
  { label: "Pacific Time (PT)", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "Frankfurt (CET/CEST)", value: "Europe/Berlin" },
  { label: "Dubai (GST)", value: "Asia/Dubai" },
  { label: "Mumbai (IST)", value: "Asia/Kolkata" },
  { label: "Singapore (SGT)", value: "Asia/Singapore" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEST/AEDT)", value: "Australia/Sydney" },
];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "SGD", "HKD", "CHF"];
const ACCOUNT_TYPES: AccountType[] = ["LIVE", "PAPER", "BACKTEST"];
const COMMISSION_TYPES = [
  { value: "per_trade", label: "Per trade (flat $)" },
  { value: "per_share", label: "Per share/contract" },
  { value: "percentage", label: "Percentage (%)" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function initials(name: string | null, email: string) {
  if (name) return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return email[0].toUpperCase();
}

function SaveButton({ saving, saved, disabled }: { saving: boolean; saved: boolean; disabled?: boolean }) {
  return (
    <button type="submit" disabled={saving || disabled}
      className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${saved ? "bg-[var(--green)] text-white" : "bg-[var(--accent)] text-white hover:opacity-90"}`}>
      {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
    </button>
  );
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--card-border)]">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {description && <p className="text-sm text-[var(--muted)] mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-white block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-[var(--muted)] mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[var(--accent)]/60 transition-colors placeholder:text-[var(--muted)]";
const selectCls = `${inputCls} cursor-pointer`;

// ── Account Modal ─────────────────────────────────────────────────────────────
function AccountModal({ initial, onClose, onSaved }: {
  initial?: Partial<Account>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name ?? "");
  const [broker, setBroker] = useState(initial?.broker ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "");
  const [accountType, setAccountType] = useState<AccountType>(initial?.accountType ?? "LIVE");
  const [initialBalance, setInitialBalance] = useState(String(initial?.initialBalance ?? ""));
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [commission, setCommission] = useState(String(initial?.commission ?? ""));
  const [commissionType, setCommissionType] = useState(initial?.commissionType ?? "per_trade");
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!name.trim()) { setErr("Account name is required"); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch(isEdit ? `/api/accounts/${initial!.id}` : "/api/accounts", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, broker: broker || null, accountNumber: accountNumber || null,
          accountType, initialBalance: parseFloat(initialBalance) || 0,
          currency, commission: parseFloat(commission) || 0, commissionType, isDefault,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved(); onClose();
    } catch (e: unknown) { setErr((e as Error).message); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-[var(--card-border)]">
          <h2 className="text-lg font-bold text-white">{isEdit ? "Edit Account" : "Add Account"}</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Account Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Live Account" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Type</label>
              <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)} className={selectCls}>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Broker</label>
              <input value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="e.g. TD Ameritrade" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Account Number</label>
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Optional" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Starting Balance</label>
              <input type="number" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectCls}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Commission</label>
              <input type="number" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Commission Type</label>
              <select value={commissionType} onChange={(e) => setCommissionType(e.target.value)} className={selectCls}>
                {COMMISSION_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-4 h-4 rounded accent-[var(--accent)]" />
            <span className="text-sm text-white">Set as default account</span>
          </label>
          {err && <p className="text-[var(--red)] text-sm">{err}</p>}
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-[var(--card-border)]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--muted)] hover:text-white">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : isEdit ? "Save" : "Add Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Types for new tabs ────────────────────────────────────────────────────────
interface AlertPrefs { emailAlerts: boolean; alertEmail: string; alertDrawdownPct: number | null; alertDailyRecap: boolean; }
interface BrokerConn { id: string; broker: string; displayName: string; accountId: string | null; environment: string; isActive: boolean; lastSyncAt: string | null; lastSyncStatus: string | null; lastSyncCount: number | null; tokenExpiresAt: string | null; createdAt: string; }

const BROKER_OPTIONS = [
  { value: "td_ameritrade", label: "TD Ameritrade / Schwab" },
  { value: "ibkr", label: "Interactive Brokers" },
  { value: "tradovate", label: "Tradovate" },
  { value: "webull", label: "Webull" },
  { value: "robinhood", label: "Robinhood" },
  { value: "etrade", label: "E*TRADE" },
  { value: "tastytrade", label: "Tastytrade" },
  { value: "other", label: "Other" },
];

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = ["Profile", "Trading", "Accounts", "Notifications", "Brokers", "AI Coach", "Security", "Billing"] as const;
type Tab = (typeof TABS)[number];

// ── Claude model options ──────────────────────────────────────────────────────
const CLAUDE_MODELS = [
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    badge: "Fastest",
    badgeColor: "text-blue-400 bg-blue-500/10",
    description: "Lightning-fast responses, ideal for quick Q&A and real-time chat. Lower token cost — great for high-frequency use.",
    speed: 5, quality: 3, cost: 1,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    badge: "Recommended",
    badgeColor: "text-[var(--accent)] bg-[var(--accent)]/10",
    description: "Best balance of intelligence and speed. Deep analysis, nuanced coaching, and complex pattern recognition.",
    speed: 4, quality: 4, cost: 3,
  },
  {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    badge: "Most Powerful",
    badgeColor: "text-purple-400 bg-purple-500/10",
    description: "Anthropic's flagship model. Maximum reasoning depth for complex multi-factor analysis and strategic coaching.",
    speed: 2, quality: 5, cost: 5,
  },
] as const;

type ClaudeModelId = (typeof CLAUDE_MODELS)[number]["id"];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Profile");
  const qc = useQueryClient();

  const { data: user, isLoading } = useQuery<UserSettings>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });
  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["accounts-full"],
    queryFn: () => fetch("/api/accounts").then((r) => r.json()),
  });
  const { data: alertPrefs, refetch: refetchAlerts } = useQuery<AlertPrefs>({
    queryKey: ["alert-prefs"],
    queryFn: () => fetch("/api/alerts").then((r) => r.json()),
    enabled: tab === "Notifications",
  });

  // ── AI model state ──
  const [aiModel, setAiModel] = useState<ClaudeModelId>("claude-sonnet-4-6");
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  useEffect(() => { if (user?.aiModel) setAiModel(user.aiModel as ClaudeModelId); }, [user]);
  const { data: brokers = [], refetch: refetchBrokers } = useQuery<BrokerConn[]>({
    queryKey: ["brokers"],
    queryFn: () => fetch("/api/brokers").then((r) => r.json()),
    enabled: tab === "Brokers",
  });

  // ── Profile tab state ──
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pSaving, setPSaving] = useState(false);
  const [pSaved, setPSaved] = useState(false);
  const [pErr, setPErr] = useState("");
  useEffect(() => { if (user) { setPName(user.name ?? ""); setPEmail(user.email); } }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault(); setPSaving(true); setPErr(""); setPSaved(false);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: pName, email: pEmail }) });
      if (!res.ok) throw new Error((await res.json()).error);
      qc.invalidateQueries({ queryKey: ["settings"] });
      setPSaved(true); setTimeout(() => setPSaved(false), 3000);
    } catch (e: unknown) { setPErr((e as Error).message); }
    finally { setPSaving(false); }
  };

  // ── Trading prefs state ──
  const [tTz, setTTz] = useState("");
  const [tCur, setTCur] = useState("");
  const [tSize, setTSize] = useState("");
  const [tRisk, setTRisk] = useState("");
  const [tSaving, setTSaving] = useState(false);
  const [tSaved, setTSaved] = useState(false);
  const [tErr, setTErr] = useState("");
  useEffect(() => { if (user) { setTTz(user.timezone); setTCur(user.currency); setTSize(String(user.accountSize)); setTRisk(String(user.riskPerTrade)); } }, [user]);

  const saveTrading = async (e: React.FormEvent) => {
    e.preventDefault(); setTSaving(true); setTErr(""); setTSaved(false);
    const riskVal = parseFloat(tRisk);
    if (isNaN(riskVal) || riskVal <= 0 || riskVal > 100) { setTErr("Risk per trade must be between 0.01 and 100"); setTSaving(false); return; }
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timezone: tTz, currency: tCur, accountSize: parseFloat(tSize) || 0, riskPerTrade: riskVal }) });
      if (!res.ok) throw new Error((await res.json()).error);
      qc.invalidateQueries({ queryKey: ["settings"] });
      setTSaved(true); setTimeout(() => setTSaved(false), 3000);
    } catch (e: unknown) { setTErr((e as Error).message); }
    finally { setTSaving(false); }
  };

  // ── Password state ──
  const [pwCur, setPwCur] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConf, setPwConf] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setPwMsg(null);
    if (pwNew !== pwConf) { setPwMsg({ type: "error", text: "Passwords do not match" }); return; }
    if (pwNew.length < 8) { setPwMsg({ type: "error", text: "New password must be at least 8 characters" }); return; }
    setPwSaving(true);
    try {
      const res = await fetch("/api/settings/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: pwCur, newPassword: pwNew }) });
      if (!res.ok) throw new Error((await res.json()).error);
      setPwCur(""); setPwNew(""); setPwConf("");
      setPwMsg({ type: "success", text: "Password updated successfully" });
    } catch (e: unknown) { setPwMsg({ type: "error", text: (e as Error).message }); }
    finally { setPwSaving(false); }
  };

  // ── Account modal state ──
  const [acctModal, setAcctModal] = useState<{ open: boolean; initial?: Partial<Account> }>({ open: false });
  const deleteAccount = useMutation({
    mutationFn: (id: string) => fetch(`/api/accounts/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: (data: { error?: string }) => {
      if (data.error) alert(data.error);
      qc.invalidateQueries({ queryKey: ["accounts-full"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" /></div>
  );
  if (!user) return null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-[var(--muted)] text-sm mt-0.5">Manage your profile, trading preferences, and accounts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--card-border)]">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t ? "border-[var(--accent)] text-white" : "border-transparent text-[var(--muted)] hover:text-white"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Profile tab ── */}
      {tab === "Profile" && (
        <form onSubmit={saveProfile} className="space-y-5">
          <SectionCard title="Profile Information" description="Your name and email address">
            <div className="flex items-center gap-5 mb-5">
              <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/20 border border-[var(--accent)]/30 flex items-center justify-center text-xl font-bold text-white shrink-0">
                {initials(pName, pEmail || user.email)}
              </div>
              <div>
                <p className="text-white font-semibold">{pName || user.email}</p>
                <p className="text-[var(--muted)] text-sm">Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Your name" className={inputCls} />
              </Field>
              <Field label="Email Address">
                <input type="email" value={pEmail} onChange={(e) => setPEmail(e.target.value)} className={inputCls} />
              </Field>
            </div>
            {pErr && <p className="text-[var(--red)] text-sm mt-3">{pErr}</p>}
          </SectionCard>
          <div className="flex justify-end">
            <SaveButton saving={pSaving} saved={pSaved} />
          </div>
        </form>
      )}

      {/* ── Trading tab ── */}
      {tab === "Trading" && (
        <form onSubmit={saveTrading} className="space-y-5">
          <SectionCard title="Trading Preferences" description="These settings affect how your analytics and risk metrics are calculated">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Timezone" hint="Used for time-of-day analytics and day-of-week breakdowns">
                <select value={tTz} onChange={(e) => setTTz(e.target.value)} className={selectCls}>
                  {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </select>
              </Field>
              <Field label="Display Currency" hint="Currency symbol shown in the UI">
                <select value={tCur} onChange={(e) => setTCur(e.target.value)} className={selectCls}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Account Size ($)" hint="Used for Kelly criterion and risk calculations">
                <input type="number" value={tSize} onChange={(e) => setTSize(e.target.value)} placeholder="25000" min="0" className={inputCls} />
              </Field>
              <Field label="Risk Per Trade (%)" hint="Default position risk as a percentage of account size">
                <input type="number" value={tRisk} onChange={(e) => setTRisk(e.target.value)} placeholder="1.0" min="0.01" max="100" step="0.01" className={inputCls} />
              </Field>
            </div>
            {tErr && <p className="text-[var(--red)] text-sm mt-3">{tErr}</p>}
          </SectionCard>

          {/* Live preview */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl px-6 py-4">
            <p className="text-xs text-[var(--muted)] uppercase tracking-wide font-semibold mb-3">Preview</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[var(--muted)] text-xs mb-0.5">Max risk per trade</p>
                <p className="text-white font-semibold">
                  {tSize && tRisk ? `$${((parseFloat(tSize) || 0) * (parseFloat(tRisk) || 0) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-xs mb-0.5">Timezone</p>
                <p className="text-white font-semibold">{TIMEZONES.find((tz) => tz.value === tTz)?.label ?? tTz}</p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-xs mb-0.5">Market open (ET 9:30 AM → local)</p>
                <p className="text-white font-semibold">
                  {tTz ? new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", timeZone: tTz, hour12: false }).format(new Date(new Date().setUTCHours(14, 30, 0, 0))) : "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <SaveButton saving={tSaving} saved={tSaved} />
          </div>
        </form>
      )}

      {/* ── Accounts tab ── */}
      {tab === "Accounts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--muted)]">{(accounts ?? []).length} account{(accounts ?? []).length !== 1 ? "s" : ""}</p>
            <button onClick={() => setAcctModal({ open: true })} className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90">
              + Add Account
            </button>
          </div>

          {(accounts ?? []).length === 0 && (
            <div className="text-center py-12 border border-dashed border-[var(--card-border)] rounded-2xl">
              <p className="text-white font-semibold mb-1">No accounts yet</p>
              <p className="text-[var(--muted)] text-sm mb-4">Add a trading account to start tracking performance by account.</p>
              <button onClick={() => setAcctModal({ open: true })} className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90">Add Account</button>
            </div>
          )}

          <div className="space-y-3">
            {(accounts ?? []).map((acct) => (
              <div key={acct.id} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white">{acct.name}</h3>
                      {acct.isDefault && <span className="text-xs bg-[var(--accent)]/20 text-[var(--accent)] px-2 py-0.5 rounded-full">Default</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${acct.accountType === "LIVE" ? "bg-[var(--green-dim)] text-[var(--green)]" : acct.accountType === "PAPER" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"}`}>
                        {acct.accountType}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                      {acct.broker && <span className="text-[var(--muted)]">Broker: <span className="text-white">{acct.broker}</span></span>}
                      <span className="text-[var(--muted)]">Balance: <span className="text-white font-mono">${acct.currentBalance.toLocaleString()}</span></span>
                      <span className="text-[var(--muted)]">Currency: <span className="text-white">{acct.currency}</span></span>
                      <span className="text-[var(--muted)]">Trades: <span className="text-white">{acct._count.trades}</span></span>
                      {acct.commission > 0 && <span className="text-[var(--muted)]">Commission: <span className="text-white">${acct.commission} {acct.commissionType.replace("_", " ")}</span></span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setAcctModal({ open: true, initial: acct })} className="text-xs text-[var(--muted)] hover:text-white border border-[var(--card-border)] px-3 py-1.5 rounded-lg transition-colors">Edit</button>
                    {!acct.isDefault && (
                      <button
                        onClick={() => { if (confirm(`Delete "${acct.name}"? This cannot be undone.`)) deleteAccount.mutate(acct.id); }}
                        className="text-xs text-[var(--muted)] hover:text-[var(--red)] border border-[var(--card-border)] hover:border-[var(--red)]/40 px-3 py-1.5 rounded-lg transition-colors">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-[var(--muted)] bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-4 py-3">
            Accounts with trades linked cannot be deleted. To retire an account, edit it and uncheck the active flag instead.
          </p>
        </div>
      )}

      {/* ── Notifications tab ── */}
      {tab === "Notifications" && (
        <NotificationsTab prefs={alertPrefs ?? null} onSaved={() => refetchAlerts()} />
      )}

      {/* ── Brokers tab ── */}
      {tab === "Brokers" && (
        <BrokersTab brokers={brokers} onChanged={() => refetchBrokers()} />
      )}

      {/* ── AI Coach tab ── */}
      {tab === "AI Coach" && (
        <div className="space-y-5">
          {/* API key status */}
          <SectionCard title="Anthropic API Key" description="Required to power the AI Coach — add ANTHROPIC_API_KEY to your .env file">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${user.aiConfigured ? "bg-[var(--green)]" : "bg-[var(--red)]"}`} />
              <span className={`text-sm font-medium ${user.aiConfigured ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                {user.aiConfigured ? "API key configured" : "Not configured — AI Coach is disabled"}
              </span>
            </div>
            {!user.aiConfigured && (
              <div className="mt-3 bg-[var(--background)] rounded-lg p-3 font-mono text-xs text-[var(--muted)]">
                <span className="text-[var(--accent)]">ANTHROPIC_API_KEY</span>=sk-ant-...
              </div>
            )}
          </SectionCard>

          {/* Model selector */}
          <SectionCard title="Claude Model" description="Choose which Claude model powers your AI trading coach">
            <div className="space-y-3">
              {CLAUDE_MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setAiModel(m.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${aiModel === m.id ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--card-border)] hover:border-[var(--card-border)]/80 bg-[var(--background)]"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${aiModel === m.id ? "border-[var(--accent)]" : "border-[var(--muted)]"}`}>
                        {aiModel === m.id && <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{m.name}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.badgeColor}`}>{m.badge}</span>
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">{m.description}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right hidden sm:block">
                      <div className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                        <span>Speed {'█'.repeat(m.speed)}{'░'.repeat(5 - m.speed)}</span>
                        <span>Quality {'█'.repeat(m.quality)}{'░'.repeat(5 - m.quality)}</span>
                        <span>Cost {'█'.repeat(m.cost)}{'░'.repeat(5 - m.cost)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-[var(--muted)]">
                Model selection applies to both AI Chat and AI Insights.
              </p>
              <button
                type="button"
                onClick={async () => {
                  setAiSaving(true); setAiSaved(false);
                  await fetch("/api/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ aiModel }),
                  });
                  qc.invalidateQueries({ queryKey: ["settings"] });
                  setAiSaving(false); setAiSaved(true);
                  setTimeout(() => setAiSaved(false), 3000);
                }}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${aiSaved ? "bg-[var(--green)] text-white" : "bg-[var(--accent)] text-white hover:opacity-90"} disabled:opacity-50`}
                disabled={aiSaving}
              >
                {aiSaving ? "Saving…" : aiSaved ? "Saved ✓" : "Save Model"}
              </button>
            </div>
          </SectionCard>

          {/* Feature table */}
          <SectionCard title="What the AI Coach Can Do">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left py-2 pr-4 text-[var(--muted)] font-medium">Capability</th>
                    <th className="text-center py-2 px-3 text-blue-400 font-medium">Haiku 4.5</th>
                    <th className="text-center py-2 px-3 text-[var(--accent)] font-medium">Sonnet 4.6</th>
                    <th className="text-center py-2 px-3 text-purple-400 font-medium">Opus 4.7</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]/40">
                  {[
                    ["Daily performance Q&A", "✓", "✓", "✓"],
                    ["Pattern recognition from stats", "Basic", "Deep", "Expert"],
                    ["Psychology & behavioural analysis", "✓", "✓", "✓"],
                    ["Multi-factor strategy review", "—", "✓", "✓"],
                    ["Drawdown root-cause analysis", "Basic", "✓", "Expert"],
                    ["Complex scenario reasoning", "—", "Good", "Best"],
                    ["Response speed", "~1s", "~2s", "~5s"],
                    ["Relative API cost", "$", "$$", "$$$$$"],
                  ].map(([cap, h, s, o]) => (
                    <tr key={cap as string}>
                      <td className="py-2.5 pr-4 text-[var(--muted)]">{cap}</td>
                      <td className="py-2.5 px-3 text-center text-white/70">{h}</td>
                      <td className="py-2.5 px-3 text-center text-white/90 font-medium">{s}</td>
                      <td className="py-2.5 px-3 text-center text-white/90">{o}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Security tab ── */}
      {tab === "Security" && (
        <div className="space-y-5">
          <form onSubmit={savePassword} className="space-y-5">
            <SectionCard title="Change Password" description="Use a strong password of at least 8 characters">
              <div className="space-y-4 max-w-sm">
                <Field label="Current Password">
                  <input type="password" value={pwCur} onChange={(e) => setPwCur(e.target.value)} autoComplete="current-password" className={inputCls} />
                </Field>
                <Field label="New Password">
                  <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} autoComplete="new-password" className={inputCls} />
                </Field>
                <Field label="Confirm New Password">
                  <input type="password" value={pwConf} onChange={(e) => setPwConf(e.target.value)} autoComplete="new-password" className={inputCls} />
                </Field>
                {pwMsg && (
                  <p className={`text-sm ${pwMsg.type === "success" ? "text-[var(--green)]" : "text-[var(--red)]"}`}>{pwMsg.text}</p>
                )}
              </div>
            </SectionCard>
            <div className="flex justify-end">
              <SaveButton saving={pwSaving} saved={false} disabled={!pwCur || !pwNew || !pwConf} />
            </div>
          </form>

          {/* 2FA */}
          <TwoFactorSection twoFactorEnabled={user.twoFactorEnabled ?? false} />

          <SectionCard title="Session Info">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Email</span>
                <span className="text-white">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Account created</span>
                <span className="text-white">{new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">2FA</span>
                <span className={user.twoFactorEnabled ? "text-[var(--green)]" : "text-[var(--muted)]"}>
                  {user.twoFactorEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Billing tab ── */}
      {tab === "Billing" && <BillingTab />}

      {/* Account modal */}
      {acctModal.open && (
        <AccountModal
          initial={acctModal.initial}
          onClose={() => setAcctModal({ open: false })}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["accounts-full"] });
            qc.invalidateQueries({ queryKey: ["accounts"] });
          }}
        />
      )}
    </div>
  );
}

// ── Notifications Tab ─────────────────────────────────────────────────────────
function NotificationsTab({ prefs, onSaved }: { prefs: AlertPrefs | null; onSaved: () => void }) {
  const [emailAlerts, setEmailAlerts] = useState(prefs?.emailAlerts ?? false);
  const [alertEmail, setAlertEmail] = useState(prefs?.alertEmail ?? "");
  const [alertDrawdownPct, setAlertDrawdownPct] = useState(String(prefs?.alertDrawdownPct ?? ""));
  const [alertDailyRecap, setAlertDailyRecap] = useState(prefs?.alertDailyRecap ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    if (prefs) {
      setEmailAlerts(prefs.emailAlerts);
      setAlertEmail(prefs.alertEmail ?? "");
      setAlertDrawdownPct(String(prefs.alertDrawdownPct ?? ""));
      setAlertDailyRecap(prefs.alertDailyRecap);
    }
  }, [prefs]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setSaved(false);
    await fetch("/api/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailAlerts,
        alertEmail: alertEmail || null,
        alertDrawdownPct: alertDrawdownPct ? parseFloat(alertDrawdownPct) : null,
        alertDailyRecap,
      }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onSaved();
  };

  const sendTest = async () => {
    setTestStatus("sending"); setTestMsg("");
    const res = await fetch("/api/alerts/test", { method: "POST" });
    const data = await res.json();
    if (res.ok) { setTestStatus("ok"); setTestMsg(`Sent to ${data.sentTo}`); }
    else { setTestStatus("err"); setTestMsg(data.error ?? "Failed"); }
    setTimeout(() => setTestStatus("idle"), 5000);
  };

  const inputCls = "w-full bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[var(--accent)]/60 transition-colors placeholder:text-[var(--muted)]";

  return (
    <form onSubmit={save} className="space-y-5">
      <SectionCard title="Email Alerts" description="Receive trading alerts and summaries by email">
        <div className="space-y-4 max-w-md">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-white">Enable Email Alerts</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">Master toggle for all email notifications</p>
            </div>
            <div onClick={() => setEmailAlerts((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${emailAlerts ? "bg-[var(--accent)]" : "bg-[var(--card-border)]"}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${emailAlerts ? "left-5" : "left-0.5"}`} />
            </div>
          </label>

          {emailAlerts && (
            <>
              <Field label="Alert Email" hint="Defaults to your account email if left blank">
                <input value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} placeholder="alerts@example.com" className={inputCls} />
              </Field>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-white">Daily Recap Email</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">Receive a session summary at end of each trading day</p>
                </div>
                <div onClick={() => setAlertDailyRecap((v) => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${alertDailyRecap ? "bg-[var(--accent)]" : "bg-[var(--card-border)]"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${alertDailyRecap ? "left-5" : "left-0.5"}`} />
                </div>
              </label>

              <Field label="Drawdown Alert (%)" hint="Send alert when account drawdown exceeds this percentage. Leave blank to disable.">
                <input type="number" value={alertDrawdownPct} onChange={(e) => setAlertDrawdownPct(e.target.value)}
                  placeholder="e.g. 10" min="1" max="100" step="0.5" className={inputCls} />
              </Field>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Push Notifications" description="Browser and mobile push alerts — no email required">
        <PushNotificationToggle />
      </SectionCard>

      <SectionCard title="SMTP Configuration" description="Add these variables to your .env file to enable email sending">
        <div className="bg-[var(--background)] rounded-lg p-3 font-mono text-xs text-[var(--muted)] space-y-1">
          <p><span className="text-[var(--accent)]">SMTP_HOST</span>=smtp.gmail.com</p>
          <p><span className="text-[var(--accent)]">SMTP_PORT</span>=587</p>
          <p><span className="text-[var(--accent)]">SMTP_USER</span>=you@gmail.com</p>
          <p><span className="text-[var(--accent)]">SMTP_PASS</span>=your_app_password</p>
          <p><span className="text-[var(--accent)]">SMTP_FROM</span>=EdgeLog &lt;noreply@yourdomain.com&gt;</p>
          <p className="pt-1 text-white/40"># For daily digest cron protection:</p>
          <p><span className="text-[var(--accent)]">CRON_SECRET</span>=your_random_secret</p>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button type="button" onClick={sendTest} disabled={testStatus === "sending"}
            className="px-4 py-2 bg-[var(--card-border)] text-white text-sm rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            {testStatus === "sending" ? "Sending…" : "Send Test Email"}
          </button>
          {testStatus === "ok" && <span className="text-xs text-[var(--green)]">✓ {testMsg}</span>}
          {testStatus === "err" && <span className="text-xs text-[var(--red)]">✗ {testMsg}</span>}
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton saving={saving} saved={saved} />
      </div>
    </form>
  );
}

// ── Brokers Tab ───────────────────────────────────────────────────────────────
const SYNC_SUPPORTED = ["tradovate", "tastytrade", "ibkr", "td_ameritrade", "schwab"];

const BROKER_SETUP: Record<string, { title: string; steps: string[]; keyLabel: string; secretLabel: string; extraFields?: { key: string; label: string; hint: string }[] }> = {
  tradovate: {
    title: "Tradovate Live Sync",
    steps: ["Enter your Tradovate username and password.", "Get your App CID and Secret from Tradovate's developer portal (tradovate.com/account → API).", "Enter the CID and Secret in the Extra Credentials field as JSON: {\"cid\":\"12345\",\"sec\":\"your-sec\"}"],
    keyLabel: "Username (email)", secretLabel: "Password",
    extraFields: [{ key: "credentials", label: "App Credentials (JSON)", hint: '{"cid":"12345","sec":"your-secret"}' }],
  },
  tastytrade: {
    title: "Tastytrade Live Sync",
    steps: ["Enter your Tastytrade username and password.", "Optionally enter your account number to sync a specific account only."],
    keyLabel: "Username", secretLabel: "Password",
  },
  ibkr: {
    title: "IBKR Client Portal Gateway",
    steps: ["Download and run the IBKR Client Portal Gateway from ibkr.com/api.", "Authenticate via the Gateway browser window.", "Enter the Gateway URL (default: https://localhost:5000) in Extra Credentials: {\"gatewayUrl\":\"https://localhost:5000\"}.", "Enter your IBKR account ID (e.g. U1234567)."],
    keyLabel: "IBKR Username (optional)", secretLabel: "IBKR Password (optional)",
    extraFields: [{ key: "credentials", label: "Gateway Config (JSON)", hint: '{"gatewayUrl":"https://localhost:5000"}' }],
  },
  td_ameritrade: {
    title: "Schwab / TD Ameritrade OAuth",
    steps: ["Register an app at developer.schwab.com.", "Set the Redirect URI to: {APP_URL}/api/brokers/oauth/schwab/callback.", "Enter the Client ID and Client Secret below.", "Click 'Connect Schwab' to authorize via OAuth."],
    keyLabel: "Client ID (App Key)", secretLabel: "Client Secret",
  },
  schwab: {
    title: "Schwab OAuth",
    steps: ["Register an app at developer.schwab.com.", "Set the Redirect URI to: {APP_URL}/api/brokers/oauth/schwab/callback.", "Enter the Client ID and Client Secret below.", "Click 'Connect Schwab' to authorize via OAuth."],
    keyLabel: "Client ID (App Key)", secretLabel: "Client Secret",
  },
};

function BrokerConnectionCard({ b, onSync, onTest, onDelete, syncing, testResult }: {
  b: BrokerConn;
  onSync: () => void;
  onTest: () => void;
  onDelete: () => void;
  syncing: boolean;
  testResult: { ok: boolean; message: string } | null;
}) {
  const supportsSync = SYNC_SUPPORTED.includes(b.broker);
  const tokenOk = !b.tokenExpiresAt || new Date(b.tokenExpiresAt) > new Date();
  const needsOAuth = (b.broker === "td_ameritrade" || b.broker === "schwab") && !b.tokenExpiresAt;

  return (
    <div className="bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${b.isActive && tokenOk ? "bg-[var(--green)]" : "bg-[var(--muted)]"}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-white">{b.displayName}</p>
              <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--card-border)] text-[var(--muted)]">
                {BROKER_OPTIONS.find((o) => o.value === b.broker)?.label ?? b.broker}
              </span>
              {b.environment !== "live" && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">{b.environment}</span>
              )}
            </div>

            {b.accountId && <p className="text-xs text-[var(--muted)] mt-0.5">Account: {b.accountId}</p>}

            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[var(--muted)]">
              {b.lastSyncAt ? (
                <>
                  <span>Last sync: {new Date(b.lastSyncAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  {b.lastSyncCount != null && <span>{b.lastSyncCount} trades imported</span>}
                  {b.lastSyncStatus && b.lastSyncStatus !== "ok" && (
                    <span className="text-yellow-500">{b.lastSyncStatus}</span>
                  )}
                </>
              ) : (
                <span>Never synced</span>
              )}
            </div>

            {testResult && (
              <p className={`text-xs mt-1 ${testResult.ok ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                {testResult.ok ? "✓" : "✗"} {testResult.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {needsOAuth && (
            <button
              onClick={async () => {
                const res = await fetch(`/api/brokers/oauth/schwab?connectionId=${b.id}`);
                const data = await res.json();
                if (data.authUrl) window.location.href = data.authUrl;
              }}
              className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-lg hover:opacity-90 font-semibold"
            >
              Connect Schwab
            </button>
          )}

          {supportsSync && !needsOAuth && (
            <button
              onClick={onTest}
              className="px-3 py-1.5 text-xs text-[var(--muted)] border border-[var(--card-border)] rounded-lg hover:text-white hover:border-white/20 transition-colors"
            >
              Test
            </button>
          )}

          {supportsSync && !needsOAuth && (
            <button
              onClick={onSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-semibold"
            >
              {syncing ? (
                <>
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  Syncing…
                </>
              ) : "Sync Now"}
            </button>
          )}

          {!supportsSync && (
            <a href="/import" className="px-3 py-1.5 text-xs text-[var(--accent)] border border-[var(--accent)]/30 rounded-lg hover:bg-[var(--accent)]/10">
              CSV Import
            </a>
          )}

          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--red)] border border-[var(--card-border)] hover:border-[var(--red)]/40 rounded-lg transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function BrokersTab({ brokers, onChanged }: { brokers: BrokerConn[]; onChanged: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [broker, setBroker] = useState("tradovate");
  const [displayName, setDisplayName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accountId, setAccountId] = useState("");
  const [environment, setEnvironment] = useState("live");
  const [credentialsJson, setCredentialsJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, { imported: number; skipped: number; errors: string[] }>>({});
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  const setup = BROKER_SETUP[broker];
  const inputCls = "w-full bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[var(--accent)]/60 transition-colors placeholder:text-[var(--muted)]";
  const selectCls = `${inputCls} cursor-pointer`;

  const addBroker = async () => {
    if (!displayName.trim()) { setErr("Display name is required"); return; }
    let credentials: Record<string, unknown> | null = null;
    if (credentialsJson.trim()) {
      try { credentials = JSON.parse(credentialsJson); } catch { setErr("Extra Credentials must be valid JSON"); return; }
    }
    setSaving(true); setErr("");
    const res = await fetch("/api/brokers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ broker, displayName: displayName.trim(), apiKey: apiKey || null, apiSecret: apiSecret || null, accountId: accountId || null, environment, credentials }),
    });
    if (!res.ok) { setErr((await res.json()).error ?? "Failed"); setSaving(false); return; }
    setSaving(false); setShowAdd(false);
    setDisplayName(""); setApiKey(""); setApiSecret(""); setAccountId(""); setCredentialsJson("");
    onChanged();
  };

  const syncBroker = async (id: string) => {
    setSyncingId(id);
    setSyncResults((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try {
      const res = await fetch(`/api/brokers/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncResults((prev) => ({ ...prev, [id]: { imported: 0, skipped: 0, errors: [data.error ?? "Sync failed"] } }));
      } else {
        setSyncResults((prev) => ({ ...prev, [id]: data }));
        onChanged();
      }
    } catch (e: unknown) {
      setSyncResults((prev) => ({ ...prev, [id]: { imported: 0, skipped: 0, errors: [(e as Error).message] } }));
    }
    setSyncingId(null);
  };

  const testBroker = async (id: string) => {
    setTestResults((prev) => { const n = { ...prev }; delete n[id]; return n; });
    const res = await fetch(`/api/brokers/${id}/test`, { method: "POST" });
    const data = await res.json();
    setTestResults((prev) => ({ ...prev, [id]: data }));
  };

  const deleteBroker = async (id: string) => {
    if (!confirm("Remove this broker connection?")) return;
    await fetch(`/api/brokers/${id}`, { method: "DELETE" });
    onChanged();
  };

  return (
    <div className="space-y-5">
      {/* Sync support matrix */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--card-border)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Live Sync Support</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">Automatic trade import from broker APIs</p>
          </div>
        </div>
        <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { name: "Tradovate", status: "live", badge: "Live Sync" },
            { name: "Tastytrade", status: "live", badge: "Live Sync" },
            { name: "IBKR", status: "live", badge: "Live Sync" },
            { name: "Schwab / TD", status: "oauth", badge: "OAuth" },
            { name: "Webull", status: "csv", badge: "CSV Only" },
            { name: "Robinhood", status: "csv", badge: "CSV Only" },
          ].map((b) => (
            <div key={b.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background)]">
              <span className="text-sm text-white">{b.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                b.status === "live" ? "bg-[var(--green-dim)] text-[var(--green)]"
                : b.status === "oauth" ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                : "bg-[var(--card-border)] text-[var(--muted)]"
              }`}>{b.badge}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Connected broker cards */}
      <SectionCard title="Connected Brokers" description="Click Sync Now to import new trades from your broker">
        {brokers.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-2">No brokers connected yet. Add one below.</p>
        ) : (
          <div className="space-y-3">
            {brokers.map((b) => {
              const syncResult = syncResults[b.id];
              return (
                <div key={b.id} className="space-y-2">
                  <BrokerConnectionCard
                    b={b}
                    onSync={() => syncBroker(b.id)}
                    onTest={() => testBroker(b.id)}
                    onDelete={() => deleteBroker(b.id)}
                    syncing={syncingId === b.id}
                    testResult={testResults[b.id] ?? null}
                  />
                  {syncResult && (
                    <div className={`px-4 py-2.5 rounded-lg text-xs ${syncResult.errors.length > 0 ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-[var(--green-dim)] border border-[var(--green)]/20"}`}>
                      {syncResult.errors.length === 0 ? (
                        <span className="text-[var(--green)]">✓ {syncResult.imported} trades imported, {syncResult.skipped} already up to date</span>
                      ) : (
                        <>
                          <span className="text-yellow-400">{syncResult.imported} imported · {syncResult.errors.length} error(s):</span>
                          <ul className="mt-1 text-yellow-400/80 space-y-0.5">
                            {syncResult.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button onClick={() => setShowAdd((v) => !v)} className="mt-4 px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90">
          + Add Broker Connection
        </button>

        {showAdd && (
          <div className="mt-4 p-5 bg-[var(--background)] rounded-xl space-y-4 border border-[var(--card-border)]">
            <h4 className="text-sm font-semibold text-white">New Broker Connection</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">Broker</label>
                <select value={broker} onChange={(e) => { setBroker(e.target.value); setCredentialsJson(""); }} className={selectCls}>
                  {BROKER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">Display Name</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. My Futures Account" className={inputCls} />
              </div>
            </div>

            {/* Setup instructions */}
            {setup && (
              <div className="bg-[var(--card)] rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-white">{setup.title} — Setup</p>
                {setup.steps.map((step, i) => (
                  <p key={i} className="text-xs text-[var(--muted)]">{i + 1}. {step}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">{setup?.keyLabel ?? "API Key"}</label>
                <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">{setup?.secretLabel ?? "API Secret"}</label>
                <input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">Account ID (optional)</label>
                <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Leave blank to sync all" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">Environment</label>
                <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className={selectCls}>
                  <option value="live">Live</option>
                  <option value="demo">Demo / Paper</option>
                </select>
              </div>
            </div>

            {setup?.extraFields?.map((f) => (
              <div key={f.key}>
                <label className="text-xs text-[var(--muted)] block mb-1">{f.label}</label>
                <input
                  value={credentialsJson}
                  onChange={(e) => setCredentialsJson(e.target.value)}
                  placeholder={f.hint}
                  className={`${inputCls} font-mono text-xs`}
                />
              </div>
            ))}

            {err && <p className="text-[var(--red)] text-sm">{err}</p>}
            <div className="flex gap-2">
              <button onClick={addBroker} disabled={saving} className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : "Add Connection"}
              </button>
              <button onClick={() => { setShowAdd(false); setErr(""); }} className="px-4 py-2 text-sm text-[var(--muted)] hover:text-white">Cancel</button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="CSV Fallback" description="All brokers support CSV export — use this when live sync isn't available">
        <p className="text-sm text-[var(--muted)] mb-3">Auto-detects column formats from TD Ameritrade, IBKR, Tradovate, Webull, Robinhood, and more.</p>
        <a href="/import" className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90">
          Go to Import Page →
        </a>
      </SectionCard>
    </div>
  );
}

// ── 2FA Section ───────────────────────────────────────────────────────────────
function TwoFactorSection({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<"idle" | "setup" | "disable">("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setLoading(true); setMsg(null);
    const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setMsg({ type: "err", text: data.error }); setLoading(false); return; }
    setQrDataUrl(data.qrDataUrl); setSecret(data.secret); setPhase("setup"); setLoading(false);
  }

  async function confirmEnable() {
    setLoading(true); setMsg(null);
    const res = await fetch("/api/auth/2fa/enable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await res.json();
    if (!res.ok) { setMsg({ type: "err", text: data.error }); setLoading(false); return; }
    setMsg({ type: "ok", text: "2FA enabled — your account is now protected." });
    setPhase("idle"); setCode(""); qc.invalidateQueries({ queryKey: ["settings"] }); setLoading(false);
  }

  async function confirmDisable() {
    setLoading(true); setMsg(null);
    const res = await fetch("/api/auth/2fa/disable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await res.json();
    if (!res.ok) { setMsg({ type: "err", text: data.error }); setLoading(false); return; }
    setMsg({ type: "ok", text: "2FA disabled." });
    setPhase("idle"); setCode(""); qc.invalidateQueries({ queryKey: ["settings"] }); setLoading(false);
  }

  const inputCls = "px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm text-white w-40 text-center tracking-widest focus:outline-none focus:border-[var(--accent)]";

  return (
    <SectionCard title="Two-Factor Authentication (2FA)" description="Add a TOTP authenticator (Google Authenticator, Authy, 1Password) for extra security">
      {msg && <p className={`text-sm mb-3 ${msg.type === "ok" ? "text-[var(--green)]" : "text-[var(--red)]"}`}>{msg.text}</p>}

      {phase === "idle" && (
        <div className="flex items-center gap-4">
          <span className={`text-sm font-medium ${twoFactorEnabled ? "text-[var(--green)]" : "text-[var(--muted)]"}`}>
            {twoFactorEnabled ? "✓ Enabled" : "Disabled"}
          </span>
          {twoFactorEnabled
            ? <button onClick={() => { setPhase("disable"); setMsg(null); }} className="px-3 py-1.5 text-sm border border-[var(--red)]/40 text-[var(--red)] rounded-lg hover:bg-[var(--red-dim)] transition-colors">Disable 2FA</button>
            : <button onClick={startSetup} disabled={loading} className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors">{loading ? "Loading…" : "Enable 2FA"}</button>
          }
        </div>
      )}

      {phase === "setup" && (
        <div className="space-y-4 max-w-sm">
          <p className="text-sm text-[var(--muted)]">Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.</p>
          {qrDataUrl && <img src={qrDataUrl} alt="2FA QR code" className="w-40 h-40 rounded-lg border border-[var(--card-border)] bg-white p-1" />}
          <p className="text-[10px] text-[var(--muted)] font-mono break-all">Manual key: {secret}</p>
          <div className="flex items-center gap-3">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000" className={inputCls} maxLength={6} />
            <button onClick={confirmEnable} disabled={loading || code.length !== 6}
              className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-lg disabled:opacity-50">
              {loading ? "Verifying…" : "Confirm"}
            </button>
            <button onClick={() => { setPhase("idle"); setCode(""); }} className="text-sm text-[var(--muted)] hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {phase === "disable" && (
        <div className="space-y-3 max-w-sm">
          <p className="text-sm text-[var(--muted)]">Enter your authenticator code to disable 2FA.</p>
          <div className="flex items-center gap-3">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000" className={inputCls} maxLength={6} autoFocus />
            <button onClick={confirmDisable} disabled={loading || code.length !== 6}
              className="px-4 py-2 bg-[var(--red)] text-white text-sm rounded-lg disabled:opacity-50">
              {loading ? "…" : "Disable"}
            </button>
            <button onClick={() => { setPhase("idle"); setCode(""); }} className="text-sm text-[var(--muted)] hover:text-white">Cancel</button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ── Billing Tab ───────────────────────────────────────────────────────────────
function BillingTab() {
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);

  const { data: sub } = useQuery<{ plan: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null>({
    queryKey: ["subscription"],
    queryFn: () => fetch("/api/stripe/subscription").then((r) => r.ok ? r.json() : null),
  });

  const plan = sub?.plan ?? "FREE";

  async function upgrade(p: "PRO" | "ELITE") {
    setUpgradeLoading(p);
    const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: p }) });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setUpgradeLoading(null);
  }

  async function openPortal() {
    setPortalLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setPortalLoading(false);
  }

  const PLAN_COLORS: Record<string, string> = { FREE: "text-[var(--muted)]", PRO: "text-[var(--accent)]", ELITE: "text-purple-400" };

  return (
    <div className="space-y-5">
      {/* Current plan */}
      <SectionCard title="Current Plan">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-2xl font-bold ${PLAN_COLORS[plan] ?? "text-white"}`}>{plan}</p>
            {sub?.currentPeriodEnd && (
              <p className="text-sm text-[var(--muted)] mt-1">
                {sub.cancelAtPeriodEnd ? "Cancels" : "Renews"} on {new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            )}
            {sub?.cancelAtPeriodEnd && (
              <p className="text-xs text-yellow-400 mt-1">Cancellation scheduled — access continues until renewal date</p>
            )}
          </div>
          {plan !== "FREE" && (
            <button onClick={openPortal} disabled={portalLoading}
              className="px-4 py-2 border border-[var(--card-border)] text-sm text-white rounded-lg hover:bg-[var(--card-border)] disabled:opacity-50 transition-colors">
              {portalLoading ? "Loading…" : "Manage Billing"}
            </button>
          )}
        </div>
      </SectionCard>

      {/* Upgrade options */}
      {plan === "FREE" && (
        <SectionCard title="Upgrade" description="Unlock the full power of EdgeLog">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(["PRO", "ELITE"] as const).map((p) => (
              <div key={p} className={`p-4 rounded-xl border ${p === "ELITE" ? "border-purple-500/40 bg-purple-500/5" : "border-[var(--accent)]/40 bg-[var(--accent)]/5"}`}>
                <p className={`font-bold text-base ${p === "ELITE" ? "text-purple-400" : "text-[var(--accent)]"}`}>{p} — ${p === "PRO" ? 19 : 39}/mo</p>
                <ul className="mt-2 space-y-1 text-xs text-[var(--muted)] mb-4">
                  {(p === "PRO"
                    ? ["Unlimited trades", "All analytics", "AI Coach (Sonnet)", "4 broker sync", "CSV/PDF export"]
                    : ["Everything in Pro", "AI Coach (Opus)", "Prop firm tracker", "Multi-leg options", "Public trade sharing"]
                  ).map((f) => <li key={f} className="flex items-center gap-1.5">✓ {f}</li>)}
                </ul>
                <button onClick={() => upgrade(p)} disabled={upgradeLoading === p}
                  className={`w-full py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 ${p === "ELITE" ? "bg-gradient-to-r from-[var(--accent)] to-purple-500" : "bg-[var(--accent)]"}`}>
                  {upgradeLoading === p ? "Loading…" : `Upgrade to ${p}`}
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Export */}
      <SectionCard title="Data Export" description="Download your trading data">
        <div className="flex flex-wrap gap-3">
          <a href={`/api/export/csv?year=${new Date().getFullYear()}`}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--card-border)] text-white text-sm rounded-lg hover:bg-white/10 transition-colors">
            ↓ CSV — {new Date().getFullYear()} Trades
          </a>
          <a href="/api/export/csv" className="flex items-center gap-2 px-4 py-2 bg-[var(--card-border)] text-white text-sm rounded-lg hover:bg-white/10 transition-colors">
            ↓ CSV — All Time
          </a>
          <a href={`/api/export/pdf?year=${new Date().getFullYear()}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-[var(--card-border)] text-white text-sm rounded-lg hover:bg-white/10 transition-colors">
            ↓ PDF Report — {new Date().getFullYear()}
          </a>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">PDF opens print dialog — save as PDF from your browser.</p>
      </SectionCard>
    </div>
  );
}
