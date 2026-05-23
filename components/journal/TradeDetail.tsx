"use client";

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SlideOver } from "@/components/shared/SlideOver";
import { formatCurrency, formatR, formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Edit2, TrendingUp, TrendingDown, Clock, Target, AlertTriangle, Camera, X, Loader2, ExternalLink, Share2, Copy, Check } from "lucide-react";

interface Props {
  tradeId: string | null;
  onClose: () => void;
  onEdit: (trade: TradeRecord) => void;
}

interface Execution {
  id: string;
  type: string;
  side: string;
  quantity: number;
  price: number;
  timestamp: string;
  commission: number;
}

interface Screenshot { id: string; url: string; label: string | null; order: number; }

interface TradeRecord {
  id: string;
  symbol: string;
  side: string;
  status: string;
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  entryTime: string;
  exitTime?: string;
  holdDuration?: number;
  grossPnl: number;
  netPnl: number;
  commission: number;
  rRatio?: number;
  maxAdverseExcursion?: number;
  maxFavorableExcursion?: number;
  setupType?: string;
  timeframe?: string;
  marketCondition?: string;
  emotionBefore?: number;
  emotionAfter?: number;
  confidence?: number;
  mistakeTags: string[];
  setupTags: string[];
  customTags: string[];
  notes?: string;
  lessonsLearned?: string;
  accountId?: string;
  playbookId?: string;
  isPublic?: boolean;
  shareToken?: string | null;
  assetClass?: string;
  currency?: string;
  originalCurrency?: string;
  originalNetPnl?: number;
  originalGrossPnl?: number;
  exchangeRate?: number;
  executions: Execution[];
  account?: { name: string };
}

function StatRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--card-border)] last:border-0">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <span className={cn("text-sm font-medium", valueClass ?? "text-white")}>{value}</span>
    </div>
  );
}

const FUTURES_MAP: Record<string, string> = {
  ES: "CME_MINI:ES1!", NQ: "CME_MINI:NQ1!", MES: "CME_MINI:MES1!", MNQ: "CME_MINI:MNQ1!",
  RTY: "CME_MINI:RTY1!", YM: "CBOT_MINI:YM1!", CL: "NYMEX:CL1!", GC: "COMEX:GC1!",
  SI: "COMEX:SI1!", NG: "NYMEX:NG1!", ZB: "CBOT:ZB1!", ZN: "CBOT:ZN1!",
};

function getTVUrl(symbol: string, assetClass?: string) {
  const mapped = FUTURES_MAP[symbol.toUpperCase()];
  if (mapped) return `https://www.tradingview.com/chart/?symbol=${mapped}`;
  if (assetClass === "CRYPTO") return `https://www.tradingview.com/chart/?symbol=BINANCE:${symbol}USDT`;
  if (assetClass === "FOREX") return `https://www.tradingview.com/chart/?symbol=FX:${symbol}`;
  return `https://www.tradingview.com/chart/?symbol=${symbol}`;
}

export function TradeDetail({ tradeId, onClose, onEdit }: Props) {
  const qc = useQueryClient();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: trade, isLoading } = useQuery<TradeRecord>({
    queryKey: ["trade", tradeId],
    queryFn: () => fetch(`/api/trades/${tradeId}`).then((r) => r.json()),
    enabled: !!tradeId,
  });

  const { data: similar = [] } = useQuery<TradeRecord[]>({
    queryKey: ["similar", tradeId],
    queryFn: () => fetch(`/api/trades/${tradeId}/similar`).then((r) => r.json()),
    enabled: !!tradeId,
  });

  const { data: screenshots = [] } = useQuery<Screenshot[]>({
    queryKey: ["screenshots", tradeId],
    queryFn: () => fetch(`/api/trades/${tradeId}/screenshots`).then((r) => r.json()),
    enabled: !!tradeId,
  });

  async function uploadScreenshot(file: File) {
    if (!tradeId) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    await fetch(`/api/trades/${tradeId}/screenshots`, { method: "POST", body: fd });
    qc.invalidateQueries({ queryKey: ["screenshots", tradeId] });
    setUploading(false);
  }

  async function deleteScreenshot(sid: string) {
    if (!tradeId) return;
    await fetch(`/api/trades/${tradeId}/screenshots/${sid}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["screenshots", tradeId] });
  }

  async function toggleShare() {
    if (!tradeId) return;
    setSharing(true);
    await fetch(`/api/trades/${tradeId}/share`, { method: "POST" });
    qc.invalidateQueries({ queryKey: ["trade", tradeId] });
    setSharing(false);
  }

  async function copyShareUrl() {
    if (!trade?.shareToken) return;
    const url = `${window.location.origin}/share/${trade.shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isWinner = (trade?.netPnl ?? 0) > 0;

  return (
    <SlideOver open={!!tradeId} onClose={onClose} title={trade ? `${trade.symbol} — ${format(new Date(trade.entryTime), "MMM d, yyyy")}` : "Trade Detail"} width="lg">
      {isLoading && (
        <div className="p-5 space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 bg-[var(--card-border)] rounded" />
          ))}
        </div>
      )}

      {trade && (
        <div className="flex flex-col h-full">
          {/* Header badge */}
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={cn("text-2xl font-bold", isWinner ? "text-[var(--green)]" : "text-[var(--red)]")}>
                {formatCurrency(trade.netPnl)}
              </span>
              {isWinner
                ? <TrendingUp className="text-[var(--green)]" size={20} />
                : <TrendingDown className="text-[var(--red)]" size={20} />}
              <span className={cn("text-sm px-2 py-0.5 rounded-full font-medium", trade.side === "LONG" ? "bg-[var(--green-dim)] text-[var(--green)]" : "bg-[var(--red-dim)] text-[var(--red)]")}>
                {trade.side}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* TradingView link */}
              <a
                href={getTVUrl(trade.symbol, trade.assetClass)}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in TradingView"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--muted)] border border-[var(--card-border)] rounded-lg hover:text-white hover:border-white/20 transition-colors"
              >
                <ExternalLink size={12} /> TV
              </a>
              {/* Share toggle */}
              <button
                onClick={toggleShare}
                disabled={sharing}
                title={trade.isPublic ? "Shared — click to unshare" : "Share trade"}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-lg transition-colors disabled:opacity-50",
                  trade.isPublic
                    ? "text-[var(--green)] border-[var(--green)]/40 hover:bg-[var(--green-dim)]"
                    : "text-[var(--muted)] border-[var(--card-border)] hover:text-white hover:border-white/20"
                )}
              >
                {sharing ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
                {trade.isPublic ? "Shared" : "Share"}
              </button>
              {/* Copy share URL (only when public) */}
              {trade.isPublic && trade.shareToken && (
                <button
                  onClick={copyShareUrl}
                  title="Copy share link"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--muted)] border border-[var(--card-border)] rounded-lg hover:text-white transition-colors"
                >
                  {copied ? <Check size={12} className="text-[var(--green)]" /> : <Copy size={12} />}
                </button>
              )}
              <button
                onClick={() => onEdit(trade)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--accent)] border border-[var(--accent)] rounded-lg hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                <Edit2 size={13} /> Edit
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
            {/* Core stats */}
            <div className="bg-[var(--background)] rounded-lg p-4">
              <StatRow label="Symbol" value={trade.symbol} />
              <StatRow label="Account" value={trade.account?.name ?? "—"} />
              <StatRow label="Entry" value={`$${trade.entryPrice.toFixed(2)} @ ${format(new Date(trade.entryTime), "HH:mm MMM d")}`} />
              <StatRow label="Exit" value={trade.exitPrice ? `$${trade.exitPrice.toFixed(2)} @ ${trade.exitTime ? format(new Date(trade.exitTime), "HH:mm MMM d") : "—"}` : "Open"} />
              <StatRow label="Quantity" value={trade.quantity.toString()} />
              <StatRow label="Gross P&L" value={formatCurrency(trade.grossPnl, trade.currency ?? "USD")} valueClass={trade.grossPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"} />
              <StatRow label="Commission" value={formatCurrency(trade.commission, trade.currency ?? "USD")} valueClass="text-[var(--muted)]" />
              <StatRow label="Net P&L" value={formatCurrency(trade.netPnl, trade.currency ?? "USD")} valueClass={isWinner ? "text-[var(--green)]" : "text-[var(--red)]"} />
              {trade.originalCurrency && trade.originalCurrency !== trade.currency && trade.originalNetPnl != null && (
                <StatRow
                  label={`Original (${trade.originalCurrency})`}
                  value={`${formatCurrency(trade.originalNetPnl, trade.originalCurrency)} @ ${trade.exchangeRate?.toFixed(4)}`}
                  valueClass="text-[var(--muted)]"
                />
              )}
              {trade.rRatio != null && <StatRow label="R-Multiple" value={formatR(trade.rRatio)} valueClass={trade.rRatio >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"} />}
              {trade.holdDuration && <StatRow label="Hold Time" value={formatDuration(trade.holdDuration)} />}
            </div>

            {/* Risk levels */}
            {(trade.stopLoss || trade.takeProfit) && (
              <div className="bg-[var(--background)] rounded-lg p-4">
                <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Risk Levels</p>
                {trade.stopLoss && (
                  <div className="flex items-center gap-2 py-1">
                    <AlertTriangle size={12} className="text-[var(--red)]" />
                    <span className="text-xs text-[var(--muted)]">Stop Loss</span>
                    <span className="ml-auto text-sm text-white">${trade.stopLoss.toFixed(2)}</span>
                  </div>
                )}
                {trade.takeProfit && (
                  <div className="flex items-center gap-2 py-1">
                    <Target size={12} className="text-[var(--green)]" />
                    <span className="text-xs text-[var(--muted)]">Take Profit</span>
                    <span className="ml-auto text-sm text-white">${trade.takeProfit.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Setup info */}
            {(trade.setupType || trade.timeframe || trade.marketCondition) && (
              <div className="bg-[var(--background)] rounded-lg p-4">
                <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Setup</p>
                {trade.setupType && <StatRow label="Setup" value={trade.setupType} />}
                {trade.timeframe && <StatRow label="Timeframe" value={trade.timeframe} />}
                {trade.marketCondition && <StatRow label="Market Condition" value={trade.marketCondition} />}
              </div>
            )}

            {/* Psychology */}
            {(trade.emotionBefore || trade.emotionAfter || trade.mistakeTags.length > 0) && (
              <div className="bg-[var(--background)] rounded-lg p-4">
                <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Psychology</p>
                {trade.emotionBefore && <StatRow label="Emotion before" value={`${trade.emotionBefore}/10`} />}
                {trade.emotionAfter && <StatRow label="Emotion after" value={`${trade.emotionAfter}/10`} />}
                {trade.confidence && <StatRow label="Confidence" value={`${trade.confidence}/10`} />}
                {trade.mistakeTags.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-[var(--muted)] mb-1.5">Mistakes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {trade.mistakeTags.map((m) => (
                        <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-[var(--red-dim)] text-[var(--red)] border border-red-800">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Executions timeline */}
            {trade.executions.length > 0 && (
              <div className="bg-[var(--background)] rounded-lg p-4">
                <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">Execution Timeline</p>
                <div className="space-y-2">
                  {trade.executions.map((ex) => (
                    <div key={ex.id} className="flex items-center gap-3 text-sm">
                      <Clock size={11} className="text-[var(--muted)] shrink-0" />
                      <span className="text-xs text-[var(--muted)] w-20 shrink-0">{format(new Date(ex.timestamp), "HH:mm")}</span>
                      <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded shrink-0", ex.type === "ENTRY" || ex.type === "ADD" ? "bg-[var(--green-dim)] text-[var(--green)]" : "bg-[var(--red-dim)] text-[var(--red)]")}>
                        {ex.type}
                      </span>
                      <span className="text-white">{ex.quantity} @ ${ex.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {(trade.notes || trade.lessonsLearned) && (
              <div className="space-y-3">
                {trade.notes && (
                  <div className="bg-[var(--background)] rounded-lg p-4">
                    <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Notes</p>
                    <p className="text-sm text-white whitespace-pre-wrap">{trade.notes}</p>
                  </div>
                )}
                {trade.lessonsLearned && (
                  <div className="bg-[var(--background)] rounded-lg p-4">
                    <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Lessons Learned</p>
                    <p className="text-sm text-white whitespace-pre-wrap">{trade.lessonsLearned}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {(trade.setupTags.length > 0 || trade.customTags.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {[...trade.setupTags, ...trade.customTags].map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[var(--card-border)] text-[var(--muted)]">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Screenshots */}
            <div className="bg-[var(--background)] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Screenshots</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:opacity-80 disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                  Add
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) { uploadScreenshot(f); e.target.value = ""; } }} />
              </div>
              {screenshots.length === 0 && !uploading && (
                <p className="text-xs text-[var(--muted)] text-center py-3">No screenshots yet — click Add to upload.</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {screenshots.map((s) => (
                  <div key={s.id} className="relative group rounded-lg overflow-hidden aspect-video bg-[var(--card-border)] cursor-pointer"
                    onClick={() => setLightbox(s.url)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt={s.label ?? "screenshot"} className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteScreenshot(s.id); }}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                    {s.label && (
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs px-2 py-1 truncate">{s.label}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Similar trades */}
            {similar.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Similar Trades</p>
                <div className="space-y-1.5">
                  {similar.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-[var(--background)] rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{s.symbol}</span>
                        <span className="text-xs text-[var(--muted)]">{s.setupType}</span>
                        <span className="text-xs text-[var(--muted)]">{format(new Date(s.entryTime), "MMM d")}</span>
                      </div>
                      <span className={cn("font-medium text-sm", s.netPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                        {formatCurrency(s.netPnl)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="screenshot" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 w-9 h-9 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20">
            <X size={18} />
          </button>
        </div>
      )}
    </SlideOver>
  );
}
