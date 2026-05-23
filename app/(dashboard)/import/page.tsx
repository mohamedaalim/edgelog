"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { BROKER_PRESETS, type BrokerFormat } from "@/lib/broker-parsers";
import { SUPPORTED_CURRENCIES, CURRENCY_META } from "@/lib/exchangeRates";

interface Account { id: string; name: string; broker: string | null; }
interface MappingResult { headers: string[]; mapping: Record<string, string>; preview: Record<string, string>[]; totalRows: number; brokerFormat?: string; }
interface ImportResult { imported: number; skipped: number; errors: string[]; }

const TRADE_FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: "symbol",     label: "Symbol",       required: true },
  { key: "side",       label: "Side",         required: true },
  { key: "entryTime",  label: "Entry Time",   required: true },
  { key: "entryPrice", label: "Entry Price",  required: true },
  { key: "quantity",   label: "Quantity",     required: true },
  { key: "exitPrice",  label: "Exit Price",   required: false },
  { key: "exitTime",   label: "Exit Time",    required: false },
  { key: "commission", label: "Commission",   required: false },
  { key: "stopLoss",   label: "Stop Loss",    required: false },
  { key: "setupType",  label: "Setup Type",   required: false },
  { key: "notes",      label: "Notes",        required: false },
];

type Step = "upload" | "map" | "confirm" | "done";

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mappingResult, setMappingResult] = useState<MappingResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<BrokerFormat | null>(null);
  const [tradeCurrency, setTradeCurrency] = useState("USD");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => fetch("/api/accounts").then((r) => r.json()),
  });

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith(".csv") && !f.name.endsWith(".txt")) {
      setErr("Please upload a CSV file (.csv or .txt)"); return;
    }
    setFile(f); setErr(""); setLoading(true);
    const form = new FormData();
    form.append("file", f);
    form.append("preview", "true");
    try {
      const res = await fetch("/api/import/csv", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMappingResult(data);
      setMapping(data.mapping);
      if (accounts?.[0]) setAccountId(accounts[0].id);
      setStep("map");
    } catch (e: unknown) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, [accounts]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const runImport = async () => {
    if (!file || !accountId) { setErr("Select an account before importing"); return; }
    setLoading(true); setErr("");
    const form = new FormData();
    form.append("file", file);
    form.append("mapping", JSON.stringify(mapping));
    form.append("accountId", accountId);
    form.append("tradeCurrency", tradeCurrency);
    try {
      const res = await fetch("/api/import/csv", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setStep("done");
    } catch (e: unknown) { setErr((e as Error).message); }
    finally { setLoading(false); }
  };

  const reset = () => {
    setStep("upload"); setFile(null); setMappingResult(null);
    setMapping({}); setResult(null); setErr(""); setTradeCurrency("USD");
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Import Trades</h1>
        <p className="text-[var(--muted)] text-sm mt-0.5">Import trades from any broker CSV export</p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2">
        {(["upload", "map", "confirm", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === s ? "bg-[var(--accent)] text-white" : ["upload","map","confirm","done"].indexOf(step) > i ? "bg-[var(--green)] text-white" : "bg-white/10 text-[var(--muted)]"}`}>
              {["upload","map","confirm","done"].indexOf(step) > i ? "✓" : i + 1}
            </div>
            <span className={`text-xs font-medium capitalize ${step === s ? "text-white" : "text-[var(--muted)]"}`}>{s}</span>
            {i < 3 && <div className="w-8 h-px bg-[var(--card-border)]" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${dragging ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--card-border)] hover:border-[var(--accent)]/50"}`}>
            <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div className="text-4xl mb-3">📂</div>
            <p className="text-white font-semibold mb-1">{loading ? "Parsing…" : "Drop your CSV here or click to browse"}</p>
            <p className="text-[var(--muted)] text-sm">Supports any broker CSV export · Max 5 MB</p>
          </div>

          {/* Broker presets */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4 space-y-3">
            <p className="text-xs text-[var(--muted)] uppercase tracking-wide font-semibold">Select Your Broker (optional — speeds up column mapping)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {BROKER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(selectedPreset === preset.id ? null : preset.id)}
                  className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                    selectedPreset === preset.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-white"
                      : "border-[var(--card-border)] text-[var(--muted)] hover:text-white hover:border-white/20"
                  }`}
                >
                  <div className="font-semibold text-[0.7rem] text-white">{preset.label}</div>
                  <div className="text-[var(--muted)] mt-0.5">{preset.description}</div>
                </button>
              ))}
              <button
                onClick={() => setSelectedPreset(null)}
                className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                  selectedPreset === null
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-white"
                    : "border-[var(--card-border)] text-[var(--muted)] hover:text-white hover:border-white/20"
                }`}
              >
                <div className="font-semibold text-[0.7rem] text-white">Generic CSV</div>
                <div className="text-[var(--muted)] mt-0.5">Auto-detect columns</div>
              </button>
            </div>

            {selectedPreset && (() => {
              const preset = BROKER_PRESETS.find((p) => p.id === selectedPreset);
              if (!preset) return null;
              return (
                <div className="bg-[var(--background)] rounded-lg px-4 py-3 border border-[var(--card-border)]">
                  <p className="text-xs font-semibold text-[var(--accent)] mb-1">How to export from {preset.label}:</p>
                  <p className="text-xs text-[var(--muted)]">{preset.instructions}</p>
                </div>
              );
            })()}
          </div>

          {err && <p className="text-[var(--red)] text-sm">{err}</p>}
        </div>
      )}

      {/* Step 2: Column mapping */}
      {step === "map" && mappingResult && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--muted)]">
              Found <strong className="text-white">{mappingResult.totalRows} rows</strong> and <strong className="text-white">{mappingResult.headers.length} columns</strong>.
              {mappingResult.brokerFormat && mappingResult.brokerFormat !== "generic" && (
                <span className="ml-2 text-[var(--green)] font-medium">Auto-detected: {mappingResult.brokerFormat.toUpperCase()}</span>
              )}
            </p>
            <button onClick={reset} className="text-xs text-[var(--muted)] hover:text-white transition-colors">← Start over</button>
          </div>

          {/* Account + currency selectors */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4 flex flex-wrap gap-6 items-end">
            <div>
              <label className="text-sm font-medium text-white block mb-2">Import into account *</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
                className="bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[var(--accent)]/50 w-64">
                <option value="">— select account —</option>
                {(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}{a.broker ? ` (${a.broker})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-white block mb-2">
                Trade currency *
                <span className="ml-2 text-xs text-[var(--muted)] font-normal">P&amp;L will be converted to account base currency</span>
              </label>
              <select value={tradeCurrency} onChange={(e) => setTradeCurrency(e.target.value)}
                className="bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[var(--accent)]/50 w-48">
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c} — {CURRENCY_META[c]?.name ?? c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mapping grid */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--card-border)] grid grid-cols-3 gap-4">
              <span className="text-xs text-[var(--muted)] font-semibold uppercase">Trade Field</span>
              <span className="text-xs text-[var(--muted)] font-semibold uppercase">CSV Column</span>
              <span className="text-xs text-[var(--muted)] font-semibold uppercase">Sample Value</span>
            </div>
            {TRADE_FIELDS.map((field) => {
              const sample = mappingResult.preview[0]?.[mapping[field.key]] ?? "—";
              return (
                <div key={field.key} className="px-5 py-3 border-b border-[var(--card-border)] grid grid-cols-3 gap-4 items-center hover:bg-white/2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium">{field.label}</span>
                    {field.required && <span className="text-xs text-[var(--red)]">*</span>}
                  </div>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value || "" }))}
                    className="bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-2 py-1.5 text-white text-sm outline-none focus:border-[var(--accent)]/50">
                    <option value="">— not mapped —</option>
                    {mappingResult.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span className="text-xs text-[var(--muted)] font-mono truncate">{sample}</span>
                </div>
              );
            })}
          </div>

          {/* Preview table */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
            <p className="px-5 py-3 text-xs text-[var(--muted)] font-semibold uppercase border-b border-[var(--card-border)]">Preview (first 5 rows)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--card-border)]">
                  {mappingResult.headers.map((h) => <th key={h} className="text-left px-3 py-2 text-[var(--muted)] font-medium whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                  {mappingResult.preview.map((row, i) => (
                    <tr key={i} className="border-b border-[var(--card-border)] hover:bg-white/3">
                      {mappingResult.headers.map((h) => <td key={h} className="px-3 py-2 text-white font-mono whitespace-nowrap">{row[h] || "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {err && <p className="text-[var(--red)] text-sm">{err}</p>}
          <div className="flex justify-end gap-3">
            <button onClick={reset} className="px-4 py-2 text-sm text-[var(--muted)] hover:text-white transition-colors">Back</button>
            <button onClick={() => setStep("confirm")} disabled={!accountId || !mapping.symbol || !mapping.side || !mapping.entryTime || !mapping.entryPrice || !mapping.quantity}
              className="px-6 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity">
              Review & Import →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === "confirm" && mappingResult && (
        <div className="space-y-5">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Ready to import</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--card-border)]">
                <p className="text-xs text-[var(--muted)] mb-1">Rows to process</p>
                <p className="text-2xl font-bold text-white">{mappingResult.totalRows}</p>
              </div>
              <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--card-border)]">
                <p className="text-xs text-[var(--muted)] mb-1">Destination account</p>
                <p className="text-base font-bold text-white">{accounts?.find((a) => a.id === accountId)?.name}</p>
              </div>
              <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--card-border)]">
                <p className="text-xs text-[var(--muted)] mb-1">Trade currency</p>
                <p className="text-base font-bold text-white">{tradeCurrency}
                  {tradeCurrency !== "USD" && (
                    <span className="ml-2 text-xs text-[var(--accent)] font-normal">→ converted at import</span>
                  )}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)] mb-2 font-semibold uppercase">Column mapping</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TRADE_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                  <div key={f.key} className="flex justify-between text-xs bg-[var(--background)] px-3 py-1.5 rounded-lg">
                    <span className="text-[var(--muted)]">{f.label}</span>
                    <span className="text-white font-mono">{mapping[f.key]}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-[var(--muted)] bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-lg px-4 py-3">
              Duplicate trades are automatically detected and skipped using a hash of symbol + side + price + time + quantity. Re-importing the same file is safe.
            </p>
          </div>
          {err && <p className="text-[var(--red)] text-sm">{err}</p>}
          <div className="flex justify-end gap-3">
            <button onClick={() => setStep("map")} className="px-4 py-2 text-sm text-[var(--muted)] hover:text-white transition-colors">Back</button>
            <button onClick={runImport} disabled={loading}
              className="px-6 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
              {loading && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
              {loading ? "Importing…" : `Import ${mappingResult.totalRows} trades`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === "done" && result && (
        <div className="text-center py-10 space-y-6">
          <div className="text-5xl">{result.imported > 0 ? "🎉" : "⚠️"}</div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Import complete</h2>
            <p className="text-[var(--muted)]">Your trades have been imported and are ready in the Trade Log.</p>
          </div>
          <div className="flex justify-center gap-4">
            <div className="bg-[var(--green-dim)] border border-[var(--green)]/20 rounded-2xl px-8 py-4 text-center">
              <p className="text-3xl font-bold text-[var(--green)]">{result.imported}</p>
              <p className="text-xs text-[var(--muted)] mt-1">Imported</p>
            </div>
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl px-8 py-4 text-center">
              <p className="text-3xl font-bold text-[var(--muted)]">{result.skipped}</p>
              <p className="text-xs text-[var(--muted)] mt-1">Skipped / dupes</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="text-left bg-[var(--red-dim)] border border-[var(--red)]/20 rounded-xl p-4 max-w-lg mx-auto">
              <p className="text-xs font-semibold text-[var(--red)] mb-2 uppercase">{result.errors.length} rows had errors</p>
              {result.errors.map((e, i) => <p key={i} className="text-xs text-[var(--muted)]">{e}</p>)}
            </div>
          )}
          <div className="flex justify-center gap-3">
            <button onClick={reset} className="px-5 py-2 bg-[var(--card)] border border-[var(--card-border)] text-white text-sm font-semibold rounded-lg hover:border-white/30 transition-colors">Import another file</button>
            <a href="/journal" className="px-5 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity">View Trade Log →</a>
          </div>
        </div>
      )}
    </div>
  );
}
