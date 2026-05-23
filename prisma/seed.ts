import { PrismaClient, AssetClass, TradeSide, TradeStatus, RuleCategory, Plan } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SYMBOLS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "GOOGL", "SPY", "QQQ", "AMD"];
const SETUPS = ["VWAP Reclaim", "Bull Flag", "Bear Flag", "Breakout", "Reversal", "Gap Fill", "Momentum", "Support Bounce"];
const CONDITIONS = ["Trending", "Ranging", "Volatile"];
const TIMEFRAMES = ["1m", "5m", "15m", "1h"];
const MISTAKES = ["FOMO", "Revenge", "Oversize", "Early Exit", "Chased", "No Setup", "Moved SL"];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number) {
  return Math.floor(randomBetween(min, max + 1));
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function getMarketOpen(date: Date): Date {
  const d = new Date(date);
  d.setHours(9, 30, 0, 0);
  return d;
}

async function main() {
  console.log("🌱 Seeding EdgeLog...");

  await prisma.tradeExecution.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.account.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.playbook.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();

  // ── Demo user ──────────────────────────────────────────────────────────────
  const password = await hash("password123", 12);
  const user = await prisma.user.create({
    data: {
      email: "demo@edgelog.io",
      name: "Alex Trader",
      password,
      timezone: "America/New_York",
      currency: "USD",
      accountSize: 50000,
      riskPerTrade: 1,
    },
  });

  // ── Subscription ──────────────────────────────────────────────────────────
  await prisma.subscription.create({
    data: {
      userId: user.id,
      plan: Plan.PRO,
      status: "active",
    },
  });

  // ── Trading account ───────────────────────────────────────────────────────
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Main Trading Account",
      broker: "Tastytrade",
      accountType: "LIVE",
      initialBalance: 50000,
      currentBalance: 57340,
      currency: "USD",
      isDefault: true,
      commission: 0.65,
      commissionType: "per_contract",
    },
  });

  // ── Rules ─────────────────────────────────────────────────────────────────
  const ruleData = [
    { text: "Only trade during the first 2 hours of market open", category: RuleCategory.ENTRY },
    { text: "Never risk more than 1% of account per trade", category: RuleCategory.RISK },
    { text: "Always set a stop loss before entering", category: RuleCategory.ENTRY },
    { text: "Do not chase trades — wait for your setup", category: RuleCategory.ENTRY },
    { text: "Take profits at 2R, move stop to breakeven", category: RuleCategory.EXIT },
    { text: "No trading after 3 consecutive losses", category: RuleCategory.PSYCHOLOGY },
    { text: "Review your plan before each trade", category: RuleCategory.MISC },
  ];
  await prisma.rule.createMany({
    data: ruleData.map((r, i) => ({ ...r, userId: user.id, order: i })),
  });

  // ── Playbooks ─────────────────────────────────────────────────────────────
  await prisma.playbook.create({
    data: {
      userId: user.id,
      name: "VWAP Reclaim Momentum",
      description: "Stock pulls back to VWAP in uptrend, entry on first 5m candle close above",
      setupType: "VWAP Reclaim",
      assetClass: [AssetClass.STOCK],
      timeframes: ["5m", "1m"],
      entryRules: "Price must be in clear uptrend on daily. Pull back to VWAP. Entry on first 5m close above VWAP.",
      exitRules: "Stop below VWAP. Target 2:1 R, partial at 1R.",
      riskRules: "Max risk 1% of account. Only trade first 2 hours.",
      isActive: true,
    },
  });

  // ── Generate 6 months of trades ───────────────────────────────────────────
  const today = new Date();
  const startDate = new Date(today);
  startDate.setMonth(startDate.getMonth() - 6);

  const trades: Parameters<typeof prisma.trade.create>[0]["data"][] = [];
  let currentDate = new Date(startDate);
  let runningPnl = 0;

  while (currentDate <= today) {
    const dow = currentDate.getDay();
    // Skip weekends
    if (dow === 0 || dow === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // 70% chance of trading on any given day
    if (Math.random() < 0.7) {
      const numTrades = randomInt(1, 4);

      for (let i = 0; i < numTrades; i++) {
        const symbol = randomItem(SYMBOLS);
        const side: TradeSide = Math.random() > 0.4 ? "LONG" : "SHORT";
        const setup = randomItem(SETUPS);
        const entryTime = new Date(getMarketOpen(currentDate));
        entryTime.setMinutes(entryTime.getMinutes() + randomInt(0, 210) + i * 45);
        const holdMinutes = randomInt(5, 180);
        const exitTime = new Date(entryTime.getTime() + holdMinutes * 60 * 1000);

        // Simulate realistic prices
        const basePrice = randomBetween(50, 500);
        const entryPrice = parseFloat(basePrice.toFixed(2));
        const priceMove = randomBetween(-0.03, 0.04); // -3% to +4%
        const isWinner = Math.random() < 0.55; // 55% win rate
        const actualMove = isWinner
          ? Math.abs(priceMove)
          : -Math.abs(priceMove) * randomBetween(0.5, 1.5);

        const direction = side === "LONG" ? 1 : -1;
        const exitPrice = parseFloat((entryPrice * (1 + direction * actualMove)).toFixed(2));
        const quantity = randomInt(10, 200);
        const commission = parseFloat((quantity * 0.005 + 0.65).toFixed(2));

        const grossPnl = parseFloat((direction * quantity * (exitPrice - entryPrice)).toFixed(2));
        const netPnl = parseFloat((grossPnl - commission).toFixed(2));
        const stopLoss = parseFloat(
          (side === "LONG" ? entryPrice * 0.98 : entryPrice * 1.02).toFixed(2)
        );
        const riskAmount = Math.abs(entryPrice - stopLoss) * quantity;
        const rRatio = riskAmount > 0 ? parseFloat((netPnl / riskAmount).toFixed(2)) : null;

        const emotionBefore = randomInt(5, 9);
        const emotionAfter = netPnl > 0 ? randomInt(6, 10) : randomInt(3, 7);
        const mistakes = netPnl < 0 && Math.random() < 0.4 ? [randomItem(MISTAKES)] : [];

        runningPnl += netPnl;

        trades.push({
          userId: user.id,
          accountId: account.id,
          symbol,
          assetClass: AssetClass.STOCK,
          side,
          status: TradeStatus.CLOSED,
          quantity,
          entryPrice,
          exitPrice,
          stopLoss,
          takeProfit: parseFloat((side === "LONG" ? entryPrice * 1.04 : entryPrice * 0.96).toFixed(2)),
          entryTime,
          exitTime,
          holdDuration: holdMinutes * 60,
          grossPnl,
          netPnl,
          commission,
          fees: 0,
          riskAmount,
          rRatio,
          setupType: setup,
          timeframe: randomItem(TIMEFRAMES),
          marketCondition: randomItem(CONDITIONS),
          emotionBefore,
          emotionAfter,
          mistakeTags: mistakes,
          setupTags: [setup],
          customTags: [],
          rulesBroken: [],
          notes: netPnl > 0
            ? `Clean ${setup} setup. Executed well.`
            : `Missed the timing on this ${setup}. Need to be more patient.`,
          isManual: true,
        });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Batch create trades
  for (const trade of trades) {
    await prisma.trade.create({ data: trade as Parameters<typeof prisma.trade.create>[0]["data"] });
  }

  // Update account balance
  await prisma.account.update({
    where: { id: account.id },
    data: { currentBalance: 50000 + runningPnl },
  });

  console.log(`✅ Seeded ${trades.length} trades across 6 months`);
  console.log(`📧 Login: demo@edgelog.io / password123`);
  console.log(`💰 Running P&L: $${runningPnl.toFixed(2)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
