"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SlideOver } from "@/components/shared/SlideOver";
import { Tabs } from "@/components/shared/Tabs";
import { Input, Select, Textarea } from "@/components/shared/Input";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { SUPPORTED_CURRENCIES } from "@/lib/exchangeRates";

const BASE_TABS = [
  { id: "details", label: "Trade Details" },
  { id: "executions", label: "Executions" },
  { id: "psychology", label: "Psychology" },
  { id: "notes", label: "Notes" },
];
const OPTIONS_TAB = { id: "multileg", label: "Multi-Leg" };

const MISTAKE_OPTIONS = ["FOMO", "Revenge", "Oversize", "Early Exit", "Chased", "No Setup", "Moved SL", "Overtraded", "No Plan"];
const SETUP_OPTIONS = ["VWAP Reclaim", "Bull Flag", "Bear Flag", "Breakout", "Reversal", "Gap Fill", "Momentum", "Support Bounce", "Resistance Reject"];
const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "Daily", "Weekly"];
const CONDITIONS = ["Trending", "Ranging", "Volatile", "Gap Up", "Gap Down"];
const ASSET_CLASSES = ["STOCK", "OPTION", "FUTURE", "FOREX", "CRYPTO"] as const;
type AssetClass = typeof ASSET_CLASSES[number];

const FUTURES_MULTIPLIERS: Record<string, number> = {
  ES: 50, NQ: 20, MES: 5, MNQ: 2, RTY: 50, YM: 5, CL: 1000, GC: 100, SI: 5000, NG: 10000,
};

interface Execution {
  type: string;
  side: string;
  quantity: string;
  price: string;
  timestamp: string;
  commission: string;
}

interface Leg {
  id: string;
  label: string;
  side: "LONG" | "SHORT";
  optionType: "call" | "put";
  strike: string;
  expiry: string;
  quantity: string;
  entryPrice: string;
  exitPrice: string;
}

interface TradeData {
  id?: string;
  accountId?: string;
  symbol?: string;
  side?: string;
  quantity?: string;
  entryPrice?: string;
  exitPrice?: string;
  entryTime?: string;
  exitTime?: string;
  stopLoss?: string;
  takeProfit?: string;
  commission?: string;
  setupType?: string;
  timeframe?: string;
  marketCondition?: string;
  emotionBefore?: number;
  emotionAfter?: number;
  confidence?: number;
  mistakeTags?: string[];
  setupTags?: string[];
  notes?: string;
  lessonsLearned?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  trade?: TradeData | null;
}

function EmotionSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const emojis = ["😭", "😢", "😟", "😕", "😐", "🙂", "😊", "😄", "🤩", "🚀"];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[var(--muted)]">{label}</label>
        <span className="text-lg">{emojis[value - 1]}</span>
      </div>
      <input type="range" min={1} max={10} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>1 (Terrible)</span>
        <span className="font-medium text-white">{value}</span>
        <span>10 (Perfect)</span>
      </div>
    </div>
  );
}

function newLeg(n: number): Leg {
  return { id: Math.random().toString(36).slice(2), label: `Leg ${n}`, side: "LONG", optionType: "call", strike: "", expiry: "", quantity: "1", entryPrice: "", exitPrice: "" };
}

export function TradeModal({ open, onClose, trade }: Props) {
  const qc = useQueryClient();
  const isEdit = !!trade?.id;

  const { data: accounts = [] } = useQuery<{ id: string; name: string; broker?: string; isDefault?: boolean }[]>({
    queryKey: ["accounts"],
    queryFn: () => fetch("/api/accounts").then((r) => r.json()),
    enabled: open,
  });

  const { data: meta } = useQuery<{ setups: string[]; symbols: string[] }>({
    queryKey: ["meta"],
    queryFn: () => fetch("/api/meta").then((r) => r.json()),
    enabled: open,
  });

  const [tab, setTab] = useState("details");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Core form state
  const [accountId, setAccountId] = useState("");
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [assetClass, setAssetClass] = useState<AssetClass>("STOCK");
  const [quantity, setQuantity] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [entryTime, setEntryTime] = useState("");
  const [exitTime, setExitTime] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [commission, setCommission] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [contractMultiplier, setContractMultiplier] = useState("");
  const [setupType, setSetupType] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [marketCondition, setMarketCondition] = useState("");
  const [emotionBefore, setEmotionBefore] = useState(7);
  const [emotionAfter, setEmotionAfter] = useState(7);
  const [confidence, setConfidence] = useState(7);
  const [mistakes, setMistakes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [lessons, setLessons] = useState("");
  const [executions, setExecutions] = useState<Execution[]>([]);

  // Options fields
  const [optionType, setOptionType] = useState<"call" | "put">("call");
  const [strike, setStrike] = useState("");
  const [optionExpiry, setOptionExpiry] = useState("");

  // Multi-leg
  const [isMultiLeg, setIsMultiLeg] = useState(false);
  const [legs, setLegs] = useState<Leg[]>([newLeg(1), newLeg(2)]);

  const TABS = assetClass === "OPTION" ? [...BASE_TABS, OPTIONS_TAB] : BASE_TABS;

  // Prefill on edit
  useEffect(() => {
    if (trade && open) {
      setAccountId(trade.accountId ?? "");
      setSymbol(trade.symbol ?? "");
      setSide((trade.side as "LONG" | "SHORT") ?? "LONG");
      setQuantity(trade.quantity ?? "");
      setEntryPrice(trade.entryPrice ?? "");
      setExitPrice(trade.exitPrice ?? "");
      setEntryTime(trade.entryTime ? trade.entryTime.slice(0, 16) : "");
      setExitTime(trade.exitTime ? trade.exitTime.slice(0, 16) : "");
      setStopLoss(trade.stopLoss ?? "");
      setTakeProfit(trade.takeProfit ?? "");
      setCommission(trade.commission ?? "");
      setCurrency((trade as { currency?: string }).currency ?? "USD");
      setSetupType(trade.setupType ?? "");
      setTimeframe(trade.timeframe ?? "");
      setMarketCondition(trade.marketCondition ?? "");
      setEmotionBefore(trade.emotionBefore ?? 7);
      setEmotionAfter(trade.emotionAfter ?? 7);
      setConfidence(trade.confidence ?? 7);
      setMistakes(trade.mistakeTags ?? []);
      setNotes(trade.notes ?? "");
      setLessons(trade.lessonsLearned ?? "");
    } else if (!trade && open) {
      setTab("details");
      setSymbol(""); setSide("LONG"); setAssetClass("STOCK"); setQuantity("");
      setEntryPrice(""); setExitPrice("");
      setEntryTime(new Date().toISOString().slice(0, 16));
      setExitTime(""); setStopLoss(""); setTakeProfit(""); setCommission("0.65");
      setContractMultiplier(""); setSetupType(""); setTimeframe("5m"); setMarketCondition(""); setCurrency("USD");
      setEmotionBefore(7); setEmotionAfter(7); setConfidence(7);
      setMistakes([]); setNotes(""); setLessons(""); setExecutions([]);
      setOptionType("call"); setStrike(""); setOptionExpiry("");
      setIsMultiLeg(false); setLegs([newLeg(1), newLeg(2)]);
      setErrors({});
    }
  }, [trade, open]);

  // Auto-fill futures multiplier
  useEffect(() => {
    if (assetClass === "FUTURE" && symbol && FUTURES_MULTIPLIERS[symbol.toUpperCase()]) {
      setContractMultiplier(String(FUTURES_MULTIPLIERS[symbol.toUpperCase()]));
    }
  }, [symbol, assetClass]);

  // Set default account and sync currency from selected account
  useEffect(() => {
    if (accounts.length && !accountId) {
      const def = accounts.find((a) => a.isDefault) ?? accounts[0];
      if (def) { setAccountId(def.id); setCurrency((def as { currency?: string }).currency ?? "USD"); }
    }
  }, [accounts, accountId]);

  useEffect(() => {
    const acc = accounts.find((a) => a.id === accountId) as { currency?: string } | undefined;
    if (acc?.currency) setCurrency(acc.currency);
  }, [accountId, accounts]);

  const multiplier = parseFloat(contractMultiplier || "1") || 1;
  const previewPnl = (() => {
    const en = parseFloat(entryPrice);
    const ex = parseFloat(exitPrice);
    const qty = parseFloat(quantity);
    const com = parseFloat(commission || "0");
    if (!en || !ex || !qty) return null;
    const dir = side === "LONG" ? 1 : -1;
    return dir * qty * (ex - en) * multiplier - com;
  })();

  const previewR = (() => {
    const en = parseFloat(entryPrice);
    const ex = parseFloat(exitPrice);
    const sl = parseFloat(stopLoss);
    if (!en || !ex || !sl) return null;
    const dir = side === "LONG" ? 1 : -1;
    const risk = Math.abs(en - sl);
    return risk > 0 ? (dir * (ex - en)) / risk : null;
  })();

  function validate() {
    const errs: Record<string, string> = {};
    if (!symbol) errs.symbol = "Required";
    if (!isMultiLeg) {
      if (!quantity || isNaN(Number(quantity))) errs.quantity = "Required";
      if (!entryPrice || isNaN(Number(entryPrice))) errs.entryPrice = "Required";
    }
    if (!entryTime) errs.entryTime = "Required";
    if (!accountId) errs.accountId = "Required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) { setTab("details"); return; }
    setSaving(true);

    try {
      if (isMultiLeg && assetClass === "OPTION") {
        const legGroupId = crypto.randomUUID();
        await Promise.all(legs.map((leg) =>
          fetch("/api/trades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountId, symbol, side: leg.side,
              assetClass: "OPTION",
              quantity: Number(leg.quantity) || 1,
              entryPrice: Number(leg.entryPrice) || 0,
              exitPrice: leg.exitPrice ? Number(leg.exitPrice) : undefined,
              entryTime,
              exitTime: exitTime || undefined,
              commission: Number(commission || 0) / legs.length,
              contractMultiplier: 100,
              optionType: leg.optionType,
              strike: leg.strike ? Number(leg.strike) : undefined,
              optionExpiry: leg.expiry || undefined,
              legGroupId,
              legLabel: leg.label,
              setupType: setupType || undefined,
              timeframe: timeframe || undefined,
              marketCondition: marketCondition || undefined,
              emotionBefore, emotionAfter, confidence,
              mistakeTags: mistakes,
              notes: notes || undefined,
              lessonsLearned: lessons || undefined,
            }),
          })
        ));
      } else {
        const payload = {
          accountId, symbol, side,
          assetClass,
          quantity: Number(quantity),
          entryPrice: Number(entryPrice),
          exitPrice: exitPrice ? Number(exitPrice) : undefined,
          entryTime, exitTime: exitTime || undefined,
          stopLoss: stopLoss ? Number(stopLoss) : undefined,
          takeProfit: takeProfit ? Number(takeProfit) : undefined,
          commission: Number(commission || 0),
          contractMultiplier: contractMultiplier ? Number(contractMultiplier) : undefined,
          setupType: setupType || undefined,
          timeframe: timeframe || undefined,
          marketCondition: marketCondition || undefined,
          emotionBefore, emotionAfter, confidence,
          mistakeTags: mistakes, setupTags: setupType ? [setupType] : [],
          notes: notes || undefined,
          lessonsLearned: lessons || undefined,
          currency,
          // Options-specific
          ...(assetClass === "OPTION" && {
            optionType,
            strike: strike ? Number(strike) : undefined,
            optionExpiry: optionExpiry || undefined,
            contractMultiplier: Number(contractMultiplier || 100),
          }),
        };

        const url = isEdit ? `/api/trades/${trade!.id}` : "/api/trades";
        const method = isEdit ? "PUT" : "POST";
        await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }

      await qc.invalidateQueries({ queryKey: ["trades"] });
      await qc.invalidateQueries({ queryKey: ["summary"] });
      await qc.invalidateQueries({ queryKey: ["equity-curve"] });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function addExecution() {
    setExecutions([...executions, { type: "ENTRY", side, quantity: "", price: "", timestamp: new Date().toISOString().slice(0, 16), commission: "0" }]);
  }
  function removeExecution(i: number) { setExecutions(executions.filter((_, idx) => idx !== i)); }

  function updateLeg(i: number, patch: Partial<Leg>) {
    setLegs(legs.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  const allSetups = Array.from(new Set([...SETUP_OPTIONS, ...(meta?.setups ?? [])]));

  return (
    <SlideOver open={open} onClose={onClose} title={isEdit ? `Edit Trade — ${trade?.symbol}` : "Log Trade"} width="lg">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="p-5 space-y-4 overflow-y-auto">
        {/* TAB: Details */}
        {tab === "details" && (
          <>
            {/* Account */}
            <Select
              label="Account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              options={accounts.map((a) => ({ value: a.id, label: `${a.name}${a.broker ? ` (${a.broker})` : ""}` }))}
            />
            {errors.accountId && <p className="text-xs text-[var(--red)] -mt-2">{errors.accountId}</p>}

            {/* Currency */}
            <div>
              <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">
                Currency
                <span className="ml-2 text-white/30 font-normal">auto-set from account</span>
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent)]/60"
              >
                {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Asset class */}
            <div>
              <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">Asset Class</label>
              <div className="flex rounded-lg overflow-hidden border border-[var(--card-border)]">
                {ASSET_CLASSES.map((ac) => (
                  <button key={ac} type="button" onClick={() => setAssetClass(ac)}
                    className={cn("flex-1 py-1.5 text-xs font-medium transition-colors",
                      assetClass === ac ? "bg-[var(--accent)] text-white" : "bg-[var(--background)] text-[var(--muted)] hover:text-white"
                    )}>
                    {ac === "STOCK" ? "Stock" : ac === "OPTION" ? "Option" : ac === "FUTURE" ? "Future" : ac === "FOREX" ? "Forex" : "Crypto"}
                  </button>
                ))}
              </div>
            </div>

            {/* Symbol + Side */}
            <div className="flex gap-3">
              <div className="flex-1">
                <Input label="Symbol" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="AAPL" list="symbol-list" error={errors.symbol} />
                <datalist id="symbol-list">{meta?.symbols.map((s) => <option key={s} value={s} />)}</datalist>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--muted)]">Side</label>
                <div className="flex rounded-lg overflow-hidden border border-[var(--card-border)]">
                  {(["LONG", "SHORT"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setSide(s)}
                      className={cn("px-4 py-2 text-sm font-medium transition-colors",
                        side === s ? (s === "LONG" ? "bg-[var(--green)] text-white" : "bg-[var(--red)] text-white")
                          : "bg-[var(--background)] text-[var(--muted)] hover:text-white"
                      )}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Options-specific: Call/Put + Strike + Expiry */}
            {assetClass === "OPTION" && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
                <div>
                  <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">Type</label>
                  <div className="flex rounded-lg overflow-hidden border border-[var(--card-border)]">
                    {(["call", "put"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setOptionType(t)}
                        className={cn("flex-1 py-1.5 text-xs font-medium transition-colors capitalize",
                          optionType === t ? "bg-[var(--accent)] text-white" : "bg-[var(--background)] text-[var(--muted)] hover:text-white"
                        )}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <Input label="Strike" type="number" step="0.5" value={strike} onChange={(e) => setStrike(e.target.value)} placeholder="450.00" />
                <Input label="Expiry" type="date" value={optionExpiry} onChange={(e) => setOptionExpiry(e.target.value)} />
              </div>
            )}

            {/* Futures: contract multiplier */}
            {assetClass === "FUTURE" && (
              <Input label="Contract Multiplier" type="number" step="1" value={contractMultiplier}
                onChange={(e) => setContractMultiplier(e.target.value)} placeholder="ES=50, NQ=20, MES=5" />
            )}

            {/* Skip price/qty fields in multi-leg mode for options */}
            {!(isMultiLeg && assetClass === "OPTION") && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Entry Price" type="number" step="0.01" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="0.00" error={errors.entryPrice} />
                  <Input label="Exit Price" type="number" step="0.01" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder="0.00 (optional)" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Entry Time" type="datetime-local" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} error={errors.entryTime} />
                  <Input label="Exit Time" type="datetime-local" value={exitTime} onChange={(e) => setExitTime(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Quantity / Contracts" type="number" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="1" error={errors.quantity} />
                  <Input label="Commission ($)" type="number" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="0.65" />
                </div>
              </>
            )}

            {isMultiLeg && assetClass === "OPTION" && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Entry Time" type="datetime-local" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} error={errors.entryTime} />
                <Input label="Commission (total, $)" type="number" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="Total for all legs" />
              </div>
            )}

            {/* Stop Loss + Take Profit */}
            {!isMultiLeg && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Stop Loss" type="number" step="0.01" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="Optional" />
                <Input label="Take Profit" type="number" step="0.01" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="Optional" />
              </div>
            )}

            {/* Setup + Timeframe + Condition */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--muted)]">Setup</label>
                <input list="setup-list" value={setupType} onChange={(e) => setSetupType(e.target.value)}
                  placeholder="e.g. Iron Condor"
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors" />
                <datalist id="setup-list">{allSetups.map((s) => <option key={s} value={s} />)}</datalist>
              </div>
              <Select label="Timeframe" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}
                options={[{ value: "", label: "Select…" }, ...TIMEFRAMES.map((t) => ({ value: t, label: t }))]} />
              <Select label="Market Condition" value={marketCondition} onChange={(e) => setMarketCondition(e.target.value)}
                options={[{ value: "", label: "Select…" }, ...CONDITIONS.map((c) => ({ value: c, label: c }))]} />
            </div>

            {/* P&L Preview */}
            {previewPnl !== null && !isMultiLeg && (
              <div className={cn("p-3 rounded-lg border text-sm font-medium",
                previewPnl >= 0 ? "bg-[var(--green-dim)] border-green-800 text-[var(--green)]" : "bg-[var(--red-dim)] border-red-800 text-[var(--red)]")}>
                Preview: Net P&L {previewPnl >= 0 ? "+" : ""}${previewPnl.toFixed(2)}
                {previewR !== null && ` · ${previewR >= 0 ? "+" : ""}${previewR.toFixed(2)}R`}
                {multiplier !== 1 && ` · ×${multiplier} multiplier`}
              </div>
            )}
          </>
        )}

        {/* TAB: Multi-Leg Options */}
        {tab === "multileg" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Multi-leg strategy</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">Log spreads, straddles, iron condors as a single grouped position</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMultiLeg(!isMultiLeg)}
                className={cn("w-11 h-6 rounded-full transition-colors relative",
                  isMultiLeg ? "bg-[var(--accent)]" : "bg-[var(--card-border)]"
                )}
              >
                <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  isMultiLeg ? "translate-x-6" : "translate-x-1"
                )} />
              </button>
            </div>

            {isMultiLeg && (
              <>
                <div className="space-y-3">
                  {legs.map((leg, i) => (
                    <div key={leg.id} className="p-3 bg-[var(--background)] rounded-lg border border-[var(--card-border)] space-y-3">
                      <div className="flex items-center justify-between">
                        <input
                          value={leg.label}
                          onChange={(e) => updateLeg(i, { label: e.target.value })}
                          className="text-sm font-medium text-white bg-transparent border-b border-[var(--card-border)] focus:outline-none focus:border-[var(--accent)] pb-0.5"
                          placeholder="Leg label"
                        />
                        {legs.length > 2 && (
                          <button onClick={() => setLegs(legs.filter((_, idx) => idx !== i))} className="text-[var(--red)] hover:bg-[var(--red-dim)] p-1 rounded transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-[var(--muted)] block mb-1">Direction</label>
                          <div className="flex rounded-lg overflow-hidden border border-[var(--card-border)]">
                            {(["LONG", "SHORT"] as const).map((s) => (
                              <button key={s} type="button" onClick={() => updateLeg(i, { side: s })}
                                className={cn("flex-1 py-1 text-xs font-medium transition-colors",
                                  leg.side === s ? (s === "LONG" ? "bg-[var(--green)] text-white" : "bg-[var(--red)] text-white")
                                    : "bg-[var(--card)] text-[var(--muted)] hover:text-white"
                                )}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[var(--muted)] block mb-1">Type</label>
                          <div className="flex rounded-lg overflow-hidden border border-[var(--card-border)]">
                            {(["call", "put"] as const).map((t) => (
                              <button key={t} type="button" onClick={() => updateLeg(i, { optionType: t })}
                                className={cn("flex-1 py-1 text-xs font-medium capitalize transition-colors",
                                  leg.optionType === t ? "bg-[var(--accent)] text-white" : "bg-[var(--card)] text-[var(--muted)] hover:text-white"
                                )}>
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input label="Strike" type="number" step="0.5" value={leg.strike} onChange={(e) => updateLeg(i, { strike: e.target.value })} placeholder="450" />
                        <Input label="Expiry" type="date" value={leg.expiry} onChange={(e) => updateLeg(i, { expiry: e.target.value })} />
                        <Input label="Qty" type="number" step="1" value={leg.quantity} onChange={(e) => updateLeg(i, { quantity: e.target.value })} placeholder="1" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="Entry Premium" type="number" step="0.01" value={leg.entryPrice} onChange={(e) => updateLeg(i, { entryPrice: e.target.value })} placeholder="2.50" />
                        <Input label="Exit Premium" type="number" step="0.01" value={leg.exitPrice} onChange={(e) => updateLeg(i, { exitPrice: e.target.value })} placeholder="Optional" />
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setLegs([...legs, newLeg(legs.length + 1)])}
                  className="flex items-center gap-2 text-sm text-[var(--accent)] hover:text-white transition-colors">
                  <Plus size={14} /> Add leg
                </button>
                <p className="text-xs text-[var(--muted)] bg-[var(--background)] px-3 py-2 rounded-lg">
                  All legs are saved as individual trades linked by a shared group ID. The symbol, account, timing, and notes apply to all legs.
                </p>
              </>
            )}

            {!isMultiLeg && (
              <div className="text-center py-8 text-[var(--muted)] text-sm">
                Enable the toggle above to log a multi-leg options strategy.
              </div>
            )}
          </div>
        )}

        {/* TAB: Executions */}
        {tab === "executions" && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--muted)]">Track scaled entries and partial exits. Each row is one fill.</p>
            {executions.length === 0 && (
              <div className="text-center py-8 text-[var(--muted)] text-sm">No executions added. Click below to add your first fill.</div>
            )}
            {executions.map((ex, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 items-end p-3 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
                <Select label="Type" value={ex.type} onChange={(e) => { const n = [...executions]; n[i].type = e.target.value; setExecutions(n); }}
                  options={["ENTRY", "ADD", "PARTIAL", "EXIT"].map((t) => ({ value: t, label: t }))} />
                <Input label="Price" type="number" step="0.01" value={ex.price} onChange={(e) => { const n = [...executions]; n[i].price = e.target.value; setExecutions(n); }} placeholder="0.00" />
                <Input label="Qty" type="number" value={ex.quantity} onChange={(e) => { const n = [...executions]; n[i].quantity = e.target.value; setExecutions(n); }} placeholder="100" />
                <Input label="Time" type="datetime-local" value={ex.timestamp} onChange={(e) => { const n = [...executions]; n[i].timestamp = e.target.value; setExecutions(n); }} />
                <button onClick={() => removeExecution(i)} className="p-2 text-[var(--red)] hover:bg-[var(--red-dim)] rounded-lg transition-colors self-end">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button onClick={addExecution} className="flex items-center gap-2 text-sm text-[var(--accent)] hover:text-white transition-colors">
              <Plus size={14} /> Add execution
            </button>
          </div>
        )}

        {/* TAB: Psychology */}
        {tab === "psychology" && (
          <div className="space-y-6">
            <EmotionSlider label="Emotion before trade" value={emotionBefore} onChange={setEmotionBefore} />
            <EmotionSlider label="Emotion after trade" value={emotionAfter} onChange={setEmotionAfter} />
            <EmotionSlider label="Confidence level" value={confidence} onChange={setConfidence} />
            <div>
              <label className="text-xs font-medium text-[var(--muted)] block mb-2">Mistake tags</label>
              <div className="flex flex-wrap gap-2">
                {MISTAKE_OPTIONS.map((m) => (
                  <button key={m} type="button"
                    onClick={() => setMistakes(mistakes.includes(m) ? mistakes.filter((x) => x !== m) : [...mistakes, m])}
                    className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                      mistakes.includes(m)
                        ? "bg-[var(--red-dim)] border-red-700 text-[var(--red)]"
                        : "bg-[var(--background)] border-[var(--card-border)] text-[var(--muted)] hover:text-white"
                    )}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Notes */}
        {tab === "notes" && (
          <div className="space-y-4">
            <Textarea label="Trade notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was your thesis? What did you see?" rows={5} />
            <Textarea label="Lessons learned" value={lessons} onChange={(e) => setLessons(e.target.value)} placeholder="What would you do differently?" rows={4} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--card-border)] shrink-0">
        <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--muted)] hover:text-white transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
          {saving ? "Saving…" : isEdit ? "Save changes" : isMultiLeg ? `Log ${legs.length} legs` : "Log trade"}
        </button>
      </div>
    </SlideOver>
  );
}
