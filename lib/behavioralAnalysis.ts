export interface TradeSample {
  netPnl: number;
  grossPnl: number;
  commission: number;
  entryTime: Date | string;
  exitTime?: Date | string | null;
  holdDuration?: number | null;
  emotionBefore?: number | null;
  emotionAfter?: number | null;
  mistakeTags: string[];
  setupType?: string | null;
  side: string;
  symbol: string;
}

interface GroupStats { trades: number; wins: number; netPnl: number; }

function stats(trades: TradeSample[]): { count: number; winRate: number; netPnl: number; avgPnl: number } {
  const wins = trades.filter((t) => t.netPnl > 0).length;
  const netPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  return {
    count: trades.length,
    winRate: trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0,
    netPnl: Math.round(netPnl * 100) / 100,
    avgPnl: trades.length > 0 ? Math.round((netPnl / trades.length) * 100) / 100 : 0,
  };
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function computeBehavioralStats(trades: TradeSample[]) {
  const closed = trades.filter((t) => t.exitTime);

  // ── Day of week ──────────────────────────────────────────────────────────────
  const dowBuckets: Record<number, TradeSample[]> = {};
  for (const t of closed) {
    const d = new Date(t.entryTime).getDay();
    (dowBuckets[d] ??= []).push(t);
  }
  const byDow = Object.entries(dowBuckets)
    .map(([d, ts]) => ({ day: DOW[Number(d)], ...stats(ts) }))
    .sort((a, b) => DOW.indexOf(a.day) - DOW.indexOf(b.day));

  // ── Hour of day ──────────────────────────────────────────────────────────────
  const hourBuckets: Record<number, TradeSample[]> = {};
  for (const t of closed) {
    const h = new Date(t.entryTime).getHours();
    (hourBuckets[h] ??= []).push(t);
  }
  const byHour = Object.entries(hourBuckets)
    .map(([h, ts]) => {
      const hour = Number(h);
      const label = hour === 0 ? "12am" : hour < 12 ? `${hour}am` : hour === 12 ? "12pm" : `${hour - 12}pm`;
      return { hour: label, hourNum: hour, ...stats(ts) };
    })
    .sort((a, b) => a.hourNum - b.hourNum);

  // ── Emotion state ────────────────────────────────────────────────────────────
  const withEmotion = closed.filter((t) => t.emotionBefore != null);
  const byEmotion = {
    low:  stats(withEmotion.filter((t) => t.emotionBefore! <= 4)),
    mid:  stats(withEmotion.filter((t) => t.emotionBefore! >= 5 && t.emotionBefore! <= 7)),
    high: stats(withEmotion.filter((t) => t.emotionBefore! >= 8)),
  };

  // ── Sequential loss behavior (revenge trading) ────────────────────────────────
  const afterLoss: Record<number, TradeSample[]> = { 1: [], 2: [], 3: [] };
  for (let i = 1; i < closed.length; i++) {
    let streak = 0;
    for (let j = i - 1; j >= 0 && streak < 3; j--) {
      if (closed[j].netPnl < 0) streak++;
      else break;
    }
    if (streak >= 1) afterLoss[Math.min(streak, 3)].push(closed[i]);
  }
  const afterConsecutiveLosses = [1, 2, 3].map((n) => ({ after: n, ...stats(afterLoss[n]) }));

  // Baseline (no recent loss)
  const noRecentLoss = closed.filter((_, i) => i > 0 && closed[i - 1].netPnl > 0);
  const baselineStats = stats(noRecentLoss);

  // ── Trades per day (overtrading) ──────────────────────────────────────────────
  const tradesByDate: Record<string, TradeSample[]> = {};
  for (const t of closed) {
    const key = new Date(t.entryTime).toISOString().slice(0, 10);
    (tradesByDate[key] ??= []).push(t);
  }
  const allByRank: Record<string, TradeSample[]> = { "1-3": [], "4-6": [], "7+": [] };
  for (const dayTrades of Object.values(tradesByDate)) {
    dayTrades.forEach((t, i) => {
      const rank = i < 3 ? "1-3" : i < 6 ? "4-6" : "7+";
      allByRank[rank].push(t);
    });
  }
  const byDailyTradeRank = Object.entries(allByRank).map(([rank, ts]) => ({ rank, ...stats(ts) }));

  // ── Hold duration ─────────────────────────────────────────────────────────────
  const withHold = closed.filter((t) => t.holdDuration != null);
  const holdBuckets: Record<string, TradeSample[]> = { "< 5min": [], "5–30min": [], "30min–2hr": [], "> 2hr": [] };
  for (const t of withHold) {
    const mins = t.holdDuration! / 60;
    if (mins < 5) holdBuckets["< 5min"].push(t);
    else if (mins < 30) holdBuckets["5–30min"].push(t);
    else if (mins < 120) holdBuckets["30min–2hr"].push(t);
    else holdBuckets["> 2hr"].push(t);
  }
  const byHoldDuration = Object.entries(holdBuckets).map(([bucket, ts]) => ({ bucket, ...stats(ts) }));

  // ── Setup performance ─────────────────────────────────────────────────────────
  const setupBuckets: Record<string, TradeSample[]> = {};
  for (const t of closed) {
    if (t.setupType) (setupBuckets[t.setupType] ??= []).push(t);
  }
  const bySetup = Object.entries(setupBuckets)
    .map(([setup, ts]) => ({ setup, ...stats(ts) }))
    .sort((a, b) => b.netPnl - a.netPnl);

  // ── Mistake tag impact ────────────────────────────────────────────────────────
  const mistakeMap: Record<string, { pnl: number[]; count: number }> = {};
  for (const t of closed) {
    for (const tag of t.mistakeTags) {
      (mistakeMap[tag] ??= { pnl: [], count: 0 }).pnl.push(t.netPnl);
      mistakeMap[tag].count++;
    }
  }
  const mistakeImpact = Object.entries(mistakeMap).map(([tag, v]) => ({
    tag,
    count: v.count,
    avgPnl: Math.round((v.pnl.reduce((s, x) => s + x, 0) / v.pnl.length) * 100) / 100,
    totalPnl: Math.round(v.pnl.reduce((s, x) => s + x, 0) * 100) / 100,
  })).sort((a, b) => a.avgPnl - b.avgPnl);

  // ── Commission drag ───────────────────────────────────────────────────────────
  const totalCommission = closed.reduce((s, t) => s + t.commission, 0);
  const totalGross = closed.reduce((s, t) => s + Math.abs(t.grossPnl), 0);
  const totalNet = closed.reduce((s, t) => s + t.netPnl, 0);
  const commission = {
    total: Math.round(totalCommission * 100) / 100,
    perTrade: closed.length > 0 ? Math.round((totalCommission / closed.length) * 100) / 100 : 0,
    asPercentOfGross: totalGross > 0 ? Math.round((totalCommission / totalGross) * 10000) / 100 : 0,
  };

  // ── Overall ───────────────────────────────────────────────────────────────────
  const overall = stats(closed);

  return {
    overall: { ...overall, totalCommission: commission.total, grossPnl: Math.round(totalGross) },
    byDow,
    byHour,
    byEmotion,
    afterConsecutiveLosses,
    baselineStats,
    byDailyTradeRank,
    byHoldDuration,
    bySetup,
    mistakeImpact,
    commission,
  };
}
