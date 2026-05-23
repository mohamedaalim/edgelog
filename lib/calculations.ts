export interface TradeStat {
  netPnl: number;
  grossPnl: number;
  rRatio?: number | null;
  commission: number;
}

export function calcWinRate(trades: TradeStat[]): number {
  if (trades.length === 0) return 0;
  const winners = trades.filter((t) => t.netPnl > 0).length;
  return (winners / trades.length) * 100;
}

export function calcProfitFactor(trades: TradeStat[]): number {
  const grossWins = trades.filter((t) => t.grossPnl > 0).reduce((s, t) => s + t.grossPnl, 0);
  const grossLosses = Math.abs(
    trades.filter((t) => t.grossPnl < 0).reduce((s, t) => s + t.grossPnl, 0)
  );
  if (grossLosses === 0) return grossWins > 0 ? 999 : 0;
  return grossWins / grossLosses;
}

export function calcExpectedValue(trades: TradeStat[]): number {
  if (trades.length === 0) return 0;
  return trades.reduce((s, t) => s + t.netPnl, 0) / trades.length;
}

export function calcTotalR(trades: TradeStat[]): number {
  return trades.reduce((s, t) => s + (t.rRatio ?? 0), 0);
}

export function calcMaxDrawdown(equityCurve: number[]): {
  maxDrawdown: number;
  maxDrawdownPct: number;
} {
  let peak = equityCurve[0] ?? 0;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;

  for (const value of equityCurve) {
    if (value > peak) peak = value;
    const drawdown = peak - value;
    const drawdownPct = peak > 0 ? drawdown / peak : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPct = drawdownPct;
    }
  }

  return { maxDrawdown, maxDrawdownPct: maxDrawdownPct * 100 };
}

export function calcSharpeRatio(dailyReturns: number[], riskFreeRate = 0): number {
  if (dailyReturns.length < 2) return 0;
  const avg = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((s, r) => s + Math.pow(r - avg, 2), 0) / (dailyReturns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return ((avg - riskFreeRate / 252) / stdDev) * Math.sqrt(252);
}

// Sharpe using percentage returns — divides each day's $ P&L by the running equity at start of day
export function calcSharpeRatioPct(
  trades: { netPnl: number }[],
  startingEquity: number,
  riskFreeRate = 0
): number {
  if (trades.length < 2 || startingEquity <= 0) return 0;
  const byDay = new Map<number, number>();
  let equity = startingEquity;
  for (const t of trades) {
    byDay.set(equity, (byDay.get(equity) ?? 0) + t.netPnl);
    equity += t.netPnl;
  }
  // Build daily % returns: pnl / equity_at_start_of_day
  let runningEq = startingEquity;
  const dailyPctReturns: number[] = [];
  for (const [startEq, dayPnl] of byDay) {
    if (startEq > 0) dailyPctReturns.push(dayPnl / startEq);
    runningEq = startEq + dayPnl;
  }
  void runningEq;
  if (dailyPctReturns.length < 2) return 0;
  const avg = dailyPctReturns.reduce((s, r) => s + r, 0) / dailyPctReturns.length;
  const variance = dailyPctReturns.reduce((s, r) => s + Math.pow(r - avg, 2), 0) / (dailyPctReturns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return ((avg - riskFreeRate / 252) / stdDev) * Math.sqrt(252);
}

export function calcKellyCriterion(winRate: number, avgWin: number, avgLoss: number): number {
  if (avgLoss === 0) return 0;
  const b = avgWin / avgLoss;
  const p = winRate / 100;
  const q = 1 - p;
  return ((p * b - q) / b) * 100;
}

export function calcConsecutiveStreaks(trades: TradeStat[]): {
  maxWinStreak: number;
  maxLossStreak: number;
} {
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentWin = 0;
  let currentLoss = 0;

  for (const trade of trades) {
    if (trade.netPnl > 0) {
      currentWin++;
      currentLoss = 0;
      maxWinStreak = Math.max(maxWinStreak, currentWin);
    } else if (trade.netPnl < 0) {
      currentLoss++;
      currentWin = 0;
      maxLossStreak = Math.max(maxLossStreak, currentLoss);
    }
    // breakeven (netPnl === 0) resets neither streak
  }

  return { maxWinStreak, maxLossStreak };
}
