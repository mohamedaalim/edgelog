"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatCurrency, formatR, formatDuration } from "@/lib/utils";
import { TradeModal } from "@/components/journal/TradeModal";
import { TradeDetail } from "@/components/journal/TradeDetail";
import {
  Search, Filter, Download, Trash2, ChevronUp, ChevronDown,
  ChevronsUpDown, ArrowLeft, ArrowRight, Tag, X,
} from "lucide-react";

const ASSET_CLASSES = ["STOCK", "OPTION", "FUTURE", "FOREX", "CRYPTO"];
const PNL_FILTERS = [
  { label: "All", value: "all" },
  { label: "Winners", value: "winners" },
  { label: "Losers", value: "losers" },
  { label: "Breakeven", value: "breakeven" },
];
const RANGE_OPTIONS = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "This Quarter", value: "quarter" },
  { label: "YTD", value: "ytd" },
  { label: "All Time", value: "all" },
];
const LIMITS = [25, 50, 100];

type SortKey = "entryTime" | "symbol" | "netPnl" | "rRatio" | "holdDuration" | "quantity";
type SortDir = "asc" | "desc";

interface TradeRow {
  id: string;
  symbol: string;
  side: string;
  assetClass: string;
  setupType?: string;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  grossPnl: number;
  netPnl: number;
  commission: number;
  rRatio?: number;
  holdDuration?: number;
  entryTime: string;
  exitTime?: string;
  mistakeTags: string[];
  customTags: string[];
  setupTags: string[];
  status: string;
  accountId?: string;
  notes?: string;
  lessonsLearned?: string;
  emotionBefore?: number;
  emotionAfter?: number;
  confidence?: number;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} className="text-[var(--muted)] opacity-40" />;
  return sortDir === "asc" ? <ChevronUp size={11} className="text-[var(--accent)]" /> : <ChevronDown size={11} className="text-[var(--accent)]" />;
}

export default function JournalPage() {
  const qc = useQueryClient();

  // Filters
  const [range, setRange] = useState("month");
  const [symbolFilter, setSymbolFilter] = useState("");
  const [assetClass, setAssetClass] = useState<string[]>([]);
  const [sideFilter, setSideFilter] = useState<"" | "LONG" | "SHORT">("");
  const [pnlFilter, setPnlFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>("entryTime");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [tagging, setTagging] = useState(false);

  // Panels
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editTrade, setEditTrade] = useState<TradeRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["trades", range, page, limit],
    queryFn: () => fetch(`/api/trades?range=${range}&page=${page}&limit=${limit}`).then((r) => r.json()),
  });

  const allTrades: TradeRow[] = data?.trades ?? [];
  const total: number = data?.total ?? 0;
  const pages: number = data?.pages ?? 1;

  const trades = useMemo(() => {
    let rows = [...allTrades];
    if (symbolFilter.trim()) rows = rows.filter((t) => t.symbol.includes(symbolFilter.trim().toUpperCase()));
    if (assetClass.length) rows = rows.filter((t) => assetClass.includes(t.assetClass));
    if (sideFilter) rows = rows.filter((t) => t.side === sideFilter);
    if (pnlFilter === "winners") rows = rows.filter((t) => t.netPnl > 0);
    if (pnlFilter === "losers") rows = rows.filter((t) => t.netPnl < 0);
    if (pnlFilter === "breakeven") rows = rows.filter((t) => t.netPnl === 0);

    rows.sort((a, b) => {
      let av: number = sortKey === "entryTime" ? new Date(a.entryTime).getTime() : (a[sortKey] as number) ?? 0;
      let bv: number = sortKey === "entryTime" ? new Date(b.entryTime).getTime() : (b[sortKey] as number) ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [allTrades, symbolFilter, assetClass, sideFilter, pnlFilter, sortKey, sortDir]);

  const totals = useMemo(() => ({
    netPnl: trades.reduce((s, t) => s + t.netPnl, 0),
    grossPnl: trades.reduce((s, t) => s + t.grossPnl, 0),
    commission: trades.reduce((s, t) => s + t.commission, 0),
    winRate: trades.length ? (trades.filter((t) => t.netPnl > 0).length / trades.length) * 100 : 0,
  }), [trades]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function toggleSelect(id: string) {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  }

  function toggleSelectAll() {
    if (selected.size === trades.length) setSelected(new Set());
    else setSelected(new Set(trades.map((t) => t.id)));
  }

  async function bulkDelete() {
    if (!selected.size || !confirm(`Delete ${selected.size} trade(s)?`)) return;
    await fetch("/api/trades/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), action: "delete" }),
    });
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["trades"] });
    qc.invalidateQueries({ queryKey: ["summary"] });
  }

  async function bulkAddTags() {
    if (!pendingTags.length) return;
    setTagging(true);
    await fetch("/api/trades/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), action: "addTags", tags: pendingTags }),
    });
    setTagModalOpen(false);
    setPendingTags([]);
    setTagInput("");
    setTagging(false);
    qc.invalidateQueries({ queryKey: ["trades"] });
  }

  function exportCsv() {
    const headers = ["Date", "Symbol", "Side", "Setup", "Entry", "Exit", "Qty", "Gross P&L", "Net P&L", "Commission", "R", "Hold Time", "Tags"];
    const rows = trades.map((t) => [
      format(new Date(t.entryTime), "yyyy-MM-dd HH:mm"),
      t.symbol, t.side, t.setupType ?? "",
      t.entryPrice, t.exitPrice ?? "",
      t.quantity, (t.grossPnl ?? 0).toFixed(2), (t.netPnl ?? 0).toFixed(2), (t.commission ?? 0).toFixed(2),
      t.rRatio?.toFixed(2) ?? "",
      t.holdDuration ? formatDuration(t.holdDuration) : "",
      [...t.setupTags, ...t.customTags].join(";"),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `trades-${range}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const colHeader = (label: string, key?: SortKey) => (
    <th
      key={label}
      onClick={() => key && toggleSort(key)}
      className={cn("text-left text-xs text-[var(--muted)] font-medium px-3 py-2.5 whitespace-nowrap", key && "cursor-pointer hover:text-white select-none")}
    >
      <div className="flex items-center gap-1">
        {label}
        {key && <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />}
      </div>
    </th>
  );

  return (
    <div className="flex flex-col gap-4 max-w-[1600px] mx-auto" style={{ height: "calc(100vh - 100px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-lg font-bold text-white">Trade Log</h1>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <button onClick={() => { setPendingTags([]); setTagInput(""); setTagModalOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--accent)] border border-[var(--accent)]/50 rounded-lg hover:bg-[var(--accent)]/10 transition-colors">
                <Tag size={13} /> Tag {selected.size}
              </button>
              <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--red)] border border-red-800 rounded-lg hover:bg-[var(--red-dim)] transition-colors">
                <Trash2 size={13} /> Delete {selected.size}
              </button>
            </>
          )}
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--muted)] border border-[var(--card-border)] rounded-lg hover:text-white transition-colors">
            <Download size={13} /> Export CSV
          </button>
          <button onClick={() => setAddOpen(true)} className="px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium rounded-lg transition-colors">
            + Log Trade
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex gap-1 bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-1">
          {RANGE_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => { setRange(o.value); setPage(1); }}
              className={cn("px-2.5 py-1 text-xs rounded-md transition-colors", range === o.value ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white")}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input value={symbolFilter} onChange={(e) => { setSymbolFilter(e.target.value); setPage(1); }} placeholder="Symbol…"
            className="pl-7 pr-3 py-1.5 bg-[var(--card)] border border-[var(--card-border)] rounded-lg text-sm text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors w-28" />
        </div>
        <div className="flex gap-1 bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-1">
          {[{ label: "All", value: "" }, { label: "Long", value: "LONG" }, { label: "Short", value: "SHORT" }].map((o) => (
            <button key={o.value} onClick={() => { setSideFilter(o.value as "" | "LONG" | "SHORT"); setPage(1); }}
              className={cn("px-2.5 py-1 text-xs rounded-md transition-colors", sideFilter === o.value ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white")}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-1">
          {PNL_FILTERS.map((o) => (
            <button key={o.value} onClick={() => { setPnlFilter(o.value); setPage(1); }}
              className={cn("px-2.5 py-1 text-xs rounded-md transition-colors", pnlFilter === o.value ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white")}>
              {o.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors", showFilters ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--card-border)] text-[var(--muted)] hover:text-white")}>
          <Filter size={11} /> Filters
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 bg-[var(--card)] border border-[var(--card-border)] rounded-lg shrink-0">
          <div>
            <p className="text-xs text-[var(--muted)] mb-1.5">Asset Class</p>
            <div className="flex gap-1.5">
              {ASSET_CLASSES.map((ac) => (
                <button key={ac} onClick={() => setAssetClass(assetClass.includes(ac) ? assetClass.filter((x) => x !== ac) : [...assetClass, ac])}
                  className={cn("px-2.5 py-1 text-xs rounded-lg border transition-colors", assetClass.includes(ac) ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--card-border)] text-[var(--muted)] hover:text-white")}>
                  {ac}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--card)] border-b border-[var(--card-border)] z-10">
              <tr>
                <th className="px-3 py-2.5 w-8">
                  <input type="checkbox" checked={selected.size === trades.length && trades.length > 0} onChange={toggleSelectAll} className="accent-[var(--accent)] cursor-pointer" />
                </th>
                {colHeader("#")}
                {colHeader("Date", "entryTime")}
                {colHeader("Symbol", "symbol")}
                {colHeader("Side")}
                {colHeader("Setup")}
                {colHeader("Entry")}
                {colHeader("Exit")}
                {colHeader("Qty", "quantity")}
                {colHeader("Gross P&L")}
                {colHeader("Net P&L", "netPnl")}
                {colHeader("Comm.")}
                {colHeader("R", "rRatio")}
                {colHeader("Hold", "holdDuration")}
                {colHeader("Tags")}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-[var(--card-border)]">
                      {Array.from({ length: 15 }).map((_, j) => (
                        <td key={j} className="px-3 py-3"><div className="h-3 bg-[var(--card-border)] rounded animate-pulse w-16" /></td>
                      ))}
                    </tr>
                  ))
                : trades.length === 0
                ? (
                  <tr><td colSpan={15} className="px-3 py-12 text-center text-[var(--muted)]">No trades match the current filters.</td></tr>
                )
                : trades.map((t, idx) => {
                    const isSelected = selected.has(t.id);
                    const tags = [...t.setupTags, ...t.customTags];
                    return (
                      <tr key={t.id} onClick={() => setDetailId(t.id)}
                        className={cn("border-b border-[var(--card-border)] cursor-pointer transition-colors", isSelected ? "bg-[var(--accent)]/10" : "hover:bg-[var(--card-border)]")}>
                        <td className="px-3 py-2.5" onClick={(e) => { e.stopPropagation(); toggleSelect(t.id); }}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(t.id)} className="accent-[var(--accent)] cursor-pointer" />
                        </td>
                        <td className="px-3 py-2.5 text-[var(--muted)] text-xs">{(page - 1) * limit + idx + 1}</td>
                        <td className="px-3 py-2.5 text-[var(--muted)] text-xs whitespace-nowrap">{format(new Date(t.entryTime), "MMM d HH:mm")}</td>
                        <td className="px-3 py-2.5 font-semibold text-white">{t.symbol}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", t.side === "LONG" ? "bg-[var(--green-dim)] text-[var(--green)]" : "bg-[var(--red-dim)] text-[var(--red)]")}>
                            {t.side}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[var(--muted)] text-xs">{t.setupType ?? "—"}</td>
                        <td className="px-3 py-2.5 text-[var(--muted)]">{t.entryPrice != null ? `$${t.entryPrice.toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2.5 text-[var(--muted)]">{t.exitPrice ? `$${t.exitPrice.toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2.5 text-[var(--muted)]">{t.quantity}</td>
                        <td className={cn("px-3 py-2.5", t.grossPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>{formatCurrency(t.grossPnl)}</td>
                        <td className={cn("px-3 py-2.5 font-semibold", t.netPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>{formatCurrency(t.netPnl)}</td>
                        <td className="px-3 py-2.5 text-[var(--muted)] text-xs">{formatCurrency(t.commission)}</td>
                        <td className={cn("px-3 py-2.5 text-xs", t.rRatio == null ? "text-[var(--muted)]" : t.rRatio >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                          {t.rRatio != null ? formatR(t.rRatio) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--muted)] text-xs whitespace-nowrap">{t.holdDuration ? formatDuration(t.holdDuration) : "—"}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1 flex-wrap">
                            {tags.slice(0, 2).map((tag) => (
                              <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-[var(--card-border)] text-[var(--muted)]">{tag}</span>
                            ))}
                            {tags.length > 2 && <span className="text-xs text-[var(--muted)]">+{tags.length - 2}</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
            {trades.length > 0 && (
              <tfoot className="sticky bottom-0 bg-[var(--card)] border-t-2 border-[var(--card-border)]">
                <tr>
                  <td colSpan={9} className="px-3 py-2.5 text-xs text-[var(--muted)] font-medium">
                    {trades.length} trades · Win Rate {(totals.winRate ?? 0).toFixed(1)}%
                  </td>
                  <td className={cn("px-3 py-2.5 text-sm font-semibold", totals.grossPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>{formatCurrency(totals.grossPnl)}</td>
                  <td className={cn("px-3 py-2.5 text-sm font-bold", totals.netPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>{formatCurrency(totals.netPnl)}</td>
                  <td className="px-3 py-2.5 text-xs text-[var(--muted)]">{formatCurrency(totals.commission)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--card-border)] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">Rows:</span>
            {LIMITS.map((l) => (
              <button key={l} onClick={() => { setLimit(l); setPage(1); }}
                className={cn("px-2 py-0.5 text-xs rounded transition-colors", limit === l ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white")}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
            <span>{Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total}</span>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="p-1 rounded hover:bg-[var(--card-border)] disabled:opacity-30 transition-colors">
              <ArrowLeft size={13} />
            </button>
            <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages}
              className="p-1 rounded hover:bg-[var(--card-border)] disabled:opacity-30 transition-colors">
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <TradeModal open={addOpen} onClose={() => setAddOpen(false)} trade={null} />
      <TradeModal
        open={!!editTrade}
        onClose={() => setEditTrade(null)}
        trade={editTrade ? {
          ...editTrade,
          quantity: String(editTrade.quantity),
          entryPrice: String(editTrade.entryPrice),
          exitPrice: editTrade.exitPrice != null ? String(editTrade.exitPrice) : undefined,
          stopLoss: undefined,
          takeProfit: undefined,
          commission: String(editTrade.commission),
        } : null}
      />
      <TradeDetail
        tradeId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(trade) => {
          setDetailId(null);
          setEditTrade(trade as unknown as TradeRow);
        }}
      />

      {/* Bulk Tag Modal */}
      {tagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={(e) => e.target === e.currentTarget && setTagModalOpen(false)}>
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Tag {selected.size} Trade{selected.size > 1 ? "s" : ""}</h3>
              <button onClick={() => setTagModalOpen(false)} className="text-[var(--muted)] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                    e.preventDefault();
                    const t = tagInput.trim().replace(/,/g, "");
                    if (t && !pendingTags.includes(t)) setPendingTags((p) => [...p, t]);
                    setTagInput("");
                  }
                }}
                placeholder="Type a tag, press Enter…"
                className="flex-1 bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button onClick={() => { const t = tagInput.trim(); if (t && !pendingTags.includes(t)) { setPendingTags((p) => [...p, t]); setTagInput(""); } }}
                className="px-3 py-2 bg-[var(--accent)] text-white text-sm rounded-lg hover:opacity-90">Add</button>
            </div>
            {pendingTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {pendingTags.map((t) => (
                  <span key={t} className="flex items-center gap-1 text-xs bg-[var(--accent)]/20 text-[var(--accent)] px-2 py-0.5 rounded-full">
                    {t}
                    <button onClick={() => setPendingTags((p) => p.filter((x) => x !== t))}><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-[var(--muted)] mb-4">Tags will be added to all selected trades without removing existing ones.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setTagModalOpen(false)} className="px-4 py-2 text-sm text-[var(--muted)] hover:text-white">Cancel</button>
              <button onClick={bulkAddTags} disabled={!pendingTags.length || tagging}
                className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
                {tagging ? "Applying…" : `Apply ${pendingTags.length} Tag${pendingTags.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
