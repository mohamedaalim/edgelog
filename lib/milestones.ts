import { prisma } from "@/lib/prisma";
import { calcProfitFactor } from "@/lib/calculations";
import { format, startOfWeek, endOfWeek, differenceInCalendarDays } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MilestoneTier = "bronze" | "silver" | "gold" | "platinum";
export type MilestoneCategory = "Volume" | "Profitability" | "Streaks" | "Discipline" | "Journal" | "Mastery";

export interface MilestoneDef {
  id: string;
  name: string;
  description: string;
  category: MilestoneCategory;
  icon: string;
  points: number;
  tier: MilestoneTier;
  // Optional: a threshold value for progress display (e.g., 100 for "trades_100")
  threshold?: number;
  progressKey?: string; // which stat to use for progress bar
}

// ── Definitions ───────────────────────────────────────────────────────────────

export const MILESTONES: MilestoneDef[] = [
  // Volume
  { id: "first_trade",  name: "First Step",       description: "Log your very first trade.",                      category: "Volume",       icon: "🚀", points: 10,  tier: "bronze",   threshold: 1,    progressKey: "totalTrades" },
  { id: "trades_10",    name: "Getting Started",  description: "Log 10 trades.",                                  category: "Volume",       icon: "📈", points: 10,  tier: "bronze",   threshold: 10,   progressKey: "totalTrades" },
  { id: "trades_50",    name: "Building Habits",  description: "Log 50 trades.",                                  category: "Volume",       icon: "📊", points: 25,  tier: "silver",   threshold: 50,   progressKey: "totalTrades" },
  { id: "trades_100",   name: "The Century",      description: "Log 100 trades.",                                 category: "Volume",       icon: "💯", points: 50,  tier: "gold",     threshold: 100,  progressKey: "totalTrades" },
  { id: "trades_500",   name: "Veteran",          description: "Log 500 trades.",                                 category: "Volume",       icon: "⚔️", points: 50,  tier: "gold",     threshold: 500,  progressKey: "totalTrades" },
  { id: "trades_1000",  name: "Elite Trader",     description: "Log 1,000 trades.",                               category: "Volume",       icon: "👑", points: 100, tier: "platinum", threshold: 1000, progressKey: "totalTrades" },

  // Profitability
  { id: "first_green",  name: "In the Green",     description: "Close your first profitable trade.",              category: "Profitability", icon: "✅", points: 10,  tier: "bronze" },
  { id: "first_green_day", name: "Green Day",     description: "Finish a trading day net positive.",              category: "Profitability", icon: "☀️", points: 10,  tier: "bronze" },
  { id: "first_green_week", name: "Green Week",   description: "Close a full trading week in profit.",            category: "Profitability", icon: "🗓️", points: 25,  tier: "silver" },
  { id: "pnl_1k",       name: "First Thousand",   description: "Reach $1,000 in cumulative net P&L.",            category: "Profitability", icon: "💵", points: 25,  tier: "silver",   threshold: 1000,  progressKey: "cumulativePnl" },
  { id: "pnl_10k",      name: "Five Figures",     description: "Reach $10,000 in cumulative net P&L.",           category: "Profitability", icon: "💰", points: 50,  tier: "gold",     threshold: 10000, progressKey: "cumulativePnl" },
  { id: "pnl_25k",      name: "Quarter Million",  description: "Reach $25,000 in cumulative net P&L.",           category: "Profitability", icon: "🏦", points: 100, tier: "platinum", threshold: 25000, progressKey: "cumulativePnl" },

  // Streaks
  { id: "win_streak_3",  name: "Hot Streak",      description: "Win 3 trades in a row.",                         category: "Streaks",       icon: "🔥", points: 10,  tier: "bronze",   threshold: 3,  progressKey: "maxWinStreak" },
  { id: "win_streak_5",  name: "On Fire",         description: "Win 5 trades in a row.",                         category: "Streaks",       icon: "⚡", points: 25,  tier: "silver",   threshold: 5,  progressKey: "maxWinStreak" },
  { id: "win_streak_10", name: "Unstoppable",     description: "Win 10 trades in a row.",                        category: "Streaks",       icon: "🌊", points: 50,  tier: "gold",     threshold: 10, progressKey: "maxWinStreak" },
  { id: "green_days_5",  name: "5-Day Run",       description: "5 consecutive profitable trading days.",         category: "Streaks",       icon: "📅", points: 25,  tier: "silver",   threshold: 5,  progressKey: "maxGreenDayStreak" },
  { id: "green_days_10", name: "Two-Week Streak", description: "10 consecutive profitable trading days.",        category: "Streaks",       icon: "🏆", points: 50,  tier: "gold",     threshold: 10, progressKey: "maxGreenDayStreak" },

  // Discipline
  { id: "rr_3plus",      name: "Great Risk/Reward", description: "Close a trade with R:R ≥ 3.",                 category: "Discipline",    icon: "🎯", points: 10,  tier: "bronze" },
  { id: "rr_5plus",      name: "Perfect Setup",     description: "Close a trade with R:R ≥ 5.",                 category: "Discipline",    icon: "🏹", points: 50,  tier: "gold" },
  { id: "playbook_10",   name: "By the Book",       description: "Complete 10 trades tagged to a playbook.",    category: "Discipline",    icon: "📖", points: 25,  tier: "silver",   threshold: 10,  progressKey: "playbookTrades" },
  { id: "playbook_50",   name: "System Trader",     description: "Complete 50 trades tagged to a playbook.",    category: "Discipline",    icon: "⚙️", points: 50,  tier: "gold",     threshold: 50,  progressKey: "playbookTrades" },
  { id: "rules_day",     name: "Flawless Execution","description": "100% rule adherence on a day with 3+ trades.", category: "Discipline", icon: "✨", points: 25,  tier: "silver" },

  // Journal
  { id: "first_journal", name: "Inner Voice",      description: "Write your first daily journal entry.",         category: "Journal",       icon: "📝", points: 10,  tier: "bronze" },
  { id: "journal_7",     name: "Weekly Reflector", description: "Journal 7 days in a row.",                     category: "Journal",       icon: "🗒️", points: 25,  tier: "silver",   threshold: 7,  progressKey: "maxJournalStreak" },
  { id: "journal_30",    name: "Mindful Month",    description: "Journal 30 days in a row.",                    category: "Journal",       icon: "🧘", points: 100, tier: "platinum", threshold: 30, progressKey: "maxJournalStreak" },
  { id: "emotion_10",    name: "Self-Aware",       description: "Log emotion scores on 10 trades.",             category: "Journal",       icon: "💭", points: 10,  tier: "bronze",   threshold: 10, progressKey: "emotionTrades" },
  { id: "emotion_50",    name: "Psychologist",     description: "Log emotion scores on 50 trades.",             category: "Journal",       icon: "🧠", points: 25,  tier: "silver",   threshold: 50, progressKey: "emotionTrades" },

  // Mastery
  { id: "setup_5",       name: "Diversified",      description: "Trade 5 different setup types.",               category: "Mastery",       icon: "🎭", points: 25,  tier: "silver",   threshold: 5,  progressKey: "uniqueSetups" },
  { id: "pf_2",          name: "Profit Machine",   description: "Achieve profit factor ≥ 2.0 (min 20 trades).", category: "Mastery",       icon: "🔬", points: 50,  tier: "gold" },
  { id: "sharpe_1",      name: "Smooth Returns",   description: "Achieve Sharpe ratio ≥ 1.0 (min 20 trades).", category: "Mastery",       icon: "📐", points: 50,  tier: "gold" },
];

export const TIER_POINTS: Record<MilestoneTier, number> = { bronze: 10, silver: 25, gold: 50, platinum: 100 };

// ── Stats computation ─────────────────────────────────────────────────────────

interface TradeRow {
  netPnl: number;
  grossPnl: number;
  commission: number;
  rRatio: number | null;
  entryTime: Date;
  emotionBefore: number | null;
  setupType: string | null;
  playbookId: string | null;
  rulesFollowed: boolean | null;
}

function maxConsecWins(trades: TradeRow[]): number {
  let max = 0; let cur = 0;
  for (const t of trades) {
    if (t.netPnl > 0) { cur++; max = Math.max(max, cur); } else if (t.netPnl < 0) cur = 0;
  }
  return max;
}

function maxGreenDayStreak(trades: TradeRow[]): number {
  const byDay = new Map<string, number>();
  for (const t of trades) {
    const d = format(t.entryTime, "yyyy-MM-dd");
    byDay.set(d, (byDay.get(d) ?? 0) + t.netPnl);
  }
  const sortedDays = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let max = 0; let cur = 0; let prevDate: string | null = null;
  for (const [d, pnl] of sortedDays) {
    const isConsec = prevDate == null || differenceInCalendarDays(new Date(d), new Date(prevDate)) === 1;
    if (pnl > 0 && isConsec) { cur++; max = Math.max(max, cur); }
    else if (pnl > 0) { cur = 1; max = Math.max(max, 1); }
    else cur = 0;
    prevDate = d;
  }
  return max;
}

function maxJournalStreak(journalDates: Date[]): number {
  if (journalDates.length === 0) return 0;
  const sorted = [...journalDates].sort((a, b) => a.getTime() - b.getTime());
  let max = 1; let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (differenceInCalendarDays(sorted[i], sorted[i - 1]) === 1) { cur++; max = Math.max(max, cur); }
    else cur = 1;
  }
  return max;
}

function hasRulesDay(trades: TradeRow[]): boolean {
  const byDay = new Map<string, TradeRow[]>();
  for (const t of trades) {
    const d = format(t.entryTime, "yyyy-MM-dd");
    const arr = byDay.get(d) ?? [];
    arr.push(t);
    byDay.set(d, arr);
  }
  for (const dayTrades of byDay.values()) {
    if (dayTrades.length >= 3 && dayTrades.every((t) => t.rulesFollowed === true)) return true;
  }
  return false;
}

function hasGreenWeek(trades: TradeRow[]): boolean {
  const byWeek = new Map<string, number>();
  for (const t of trades) {
    const wk = format(startOfWeek(t.entryTime, { weekStartsOn: 1 }), "yyyy-MM-dd");
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + t.netPnl);
  }
  return [...byWeek.values()].some((v) => v > 0);
}

export interface MilestoneStats {
  totalTrades: number;
  cumulativePnl: number;
  maxWinStreak: number;
  maxGreenDayStreak: number;
  maxJournalStreak: number;
  emotionTrades: number;
  playbookTrades: number;
  uniqueSetups: number;
  hasFirstGreen: boolean;
  hasFirstGreenDay: boolean;
  hasFirstGreenWeek: boolean;
  hasRulesDay: boolean;
  maxRRatio: number;
  profitFactor: number;
  sharpe: number;
  hasJournal: boolean;
}

export function computeStats(trades: TradeRow[], journalDates: Date[]): MilestoneStats {
  const closedTrades = trades.filter((t) => t.netPnl !== 0 || t.grossPnl !== 0);
  const cumulativePnl = trades.reduce((s, t) => s + t.netPnl, 0);

  // Daily P&L for green day check
  const byDay = new Map<string, number>();
  for (const t of trades) {
    const d = format(t.entryTime, "yyyy-MM-dd");
    byDay.set(d, (byDay.get(d) ?? 0) + t.netPnl);
  }

  // Sharpe (daily $ returns)
  const dailyPnls = [...byDay.values()];
  let sharpe = 0;
  if (dailyPnls.length >= 2) {
    const avg = dailyPnls.reduce((s, v) => s + v, 0) / dailyPnls.length;
    const std = Math.sqrt(dailyPnls.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / (dailyPnls.length - 1));
    if (std > 0) sharpe = (avg / std) * Math.sqrt(252);
  }

  const setups = new Set(trades.map((t) => t.setupType).filter(Boolean));

  return {
    totalTrades: trades.length,
    cumulativePnl,
    maxWinStreak: maxConsecWins(trades),
    maxGreenDayStreak: maxGreenDayStreak(trades),
    maxJournalStreak: maxJournalStreak(journalDates),
    emotionTrades: trades.filter((t) => t.emotionBefore != null).length,
    playbookTrades: trades.filter((t) => t.playbookId != null).length,
    uniqueSetups: setups.size,
    hasFirstGreen: trades.some((t) => t.netPnl > 0),
    hasFirstGreenDay: [...byDay.values()].some((v) => v > 0),
    hasFirstGreenWeek: hasGreenWeek(trades),
    hasRulesDay: hasRulesDay(trades),
    maxRRatio: trades.reduce((m, t) => Math.max(m, t.rRatio ?? 0), 0),
    profitFactor: closedTrades.length >= 20 ? calcProfitFactor(closedTrades.map((t) => ({ ...t, rRatio: t.rRatio ?? null }))) : 0,
    sharpe,
    hasJournal: journalDates.length > 0,
  };
}

export function evaluateMilestone(id: string, stats: MilestoneStats): boolean {
  switch (id) {
    case "first_trade":      return stats.totalTrades >= 1;
    case "trades_10":        return stats.totalTrades >= 10;
    case "trades_50":        return stats.totalTrades >= 50;
    case "trades_100":       return stats.totalTrades >= 100;
    case "trades_500":       return stats.totalTrades >= 500;
    case "trades_1000":      return stats.totalTrades >= 1000;
    case "first_green":      return stats.hasFirstGreen;
    case "first_green_day":  return stats.hasFirstGreenDay;
    case "first_green_week": return stats.hasFirstGreenWeek;
    case "pnl_1k":           return stats.cumulativePnl >= 1000;
    case "pnl_10k":          return stats.cumulativePnl >= 10000;
    case "pnl_25k":          return stats.cumulativePnl >= 25000;
    case "win_streak_3":     return stats.maxWinStreak >= 3;
    case "win_streak_5":     return stats.maxWinStreak >= 5;
    case "win_streak_10":    return stats.maxWinStreak >= 10;
    case "green_days_5":     return stats.maxGreenDayStreak >= 5;
    case "green_days_10":    return stats.maxGreenDayStreak >= 10;
    case "rr_3plus":         return stats.maxRRatio >= 3;
    case "rr_5plus":         return stats.maxRRatio >= 5;
    case "playbook_10":      return stats.playbookTrades >= 10;
    case "playbook_50":      return stats.playbookTrades >= 50;
    case "rules_day":        return stats.hasRulesDay;
    case "first_journal":    return stats.hasJournal;
    case "journal_7":        return stats.maxJournalStreak >= 7;
    case "journal_30":       return stats.maxJournalStreak >= 30;
    case "emotion_10":       return stats.emotionTrades >= 10;
    case "emotion_50":       return stats.emotionTrades >= 50;
    case "setup_5":          return stats.uniqueSetups >= 5;
    case "pf_2":             return stats.profitFactor >= 2;
    case "sharpe_1":         return stats.sharpe >= 1;
    default:                 return false;
  }
}

// ── Check + unlock ─────────────────────────────────────────────────────────────

export async function checkMilestones(userId: string): Promise<string[]> {
  const [trades, journals, existing] = await Promise.all([
    prisma.trade.findMany({
      where: { userId, status: "CLOSED" },
      select: { netPnl: true, grossPnl: true, commission: true, rRatio: true, entryTime: true, emotionBefore: true, setupType: true, playbookId: true, rulesFollowed: true },
      orderBy: { entryTime: "asc" },
    }),
    prisma.journalEntry.findMany({ where: { userId }, select: { date: true } }),
    prisma.userMilestone.findMany({ where: { userId }, select: { milestoneId: true } }),
  ]);

  const stats = computeStats(trades, journals.map((j) => j.date));
  const alreadyUnlocked = new Set(existing.map((e) => e.milestoneId));
  const newlyUnlocked: string[] = [];

  for (const m of MILESTONES) {
    if (alreadyUnlocked.has(m.id)) continue;
    if (evaluateMilestone(m.id, stats)) newlyUnlocked.push(m.id);
  }

  if (newlyUnlocked.length > 0) {
    await prisma.userMilestone.createMany({
      data: newlyUnlocked.map((milestoneId) => ({ userId, milestoneId })),
      skipDuplicates: true,
    });
  }

  return newlyUnlocked;
}
