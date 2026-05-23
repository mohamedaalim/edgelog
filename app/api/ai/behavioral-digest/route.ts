import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { subDays, startOfWeek, format } from "date-fns";
import { computeBehavioralStats } from "@/lib/behavioralAnalysis";
import { sendPushNotification, isPushConfigured } from "@/lib/webpush";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET — return most recent digest (generate if >7d old or missing)
export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ configured: false });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";

  // Check for existing recent digest
  if (!force) {
    const recent = await prisma.behavioralDigest.findFirst({
      where: { userId: userId!, createdAt: { gte: subDays(new Date(), 7) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      return NextResponse.json({ configured: true, digest: recent, cached: true });
    }
  }

  return generateAndReturn(userId!);
}

// POST — force regenerate
export async function POST() {
  const { userId, error } = await requireSession();
  if (error) return error;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ configured: false });
  }

  return generateAndReturn(userId!);
}

async function generateAndReturn(userId: string) {
  const since = subDays(new Date(), 28);

  const [user, trades] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, accountSize: true, riskPerTrade: true, aiModel: true },
    }),
    prisma.trade.findMany({
      where: { userId, status: "CLOSED", entryTime: { gte: since } },
      select: {
        netPnl: true, grossPnl: true, commission: true,
        entryTime: true, exitTime: true, holdDuration: true,
        emotionBefore: true, emotionAfter: true, mistakeTags: true,
        setupType: true, side: true, symbol: true,
      },
      orderBy: { entryTime: "asc" },
    }),
  ]);

  if (trades.length < 10) {
    return NextResponse.json({
      configured: true,
      digest: null,
      message: `Log at least 10 closed trades in the last 28 days to generate a behavioral digest. You have ${trades.length}.`,
    });
  }

  const stats = computeBehavioralStats(
    trades.map((t) => ({ ...t, entryTime: new Date(t.entryTime), exitTime: t.exitTime ? new Date(t.exitTime) : null }))
  );

  // Build compact data blob for Claude
  const dowSummary = stats.byDow
    .filter((d) => d.count >= 2)
    .map((d) => `${d.day}: ${d.count} trades, ${d.winRate}% WR, $${d.netPnl}`)
    .join(" | ");

  const hourSummary = stats.byHour
    .filter((h) => h.count >= 2)
    .map((h) => `${h.hour}: ${h.count} trades, ${h.winRate}% WR, $${h.netPnl}`)
    .join(" | ");

  const emotionSummary = `Low state (1-4): ${stats.byEmotion.low.count} trades, ${stats.byEmotion.low.winRate}% WR, $${stats.byEmotion.low.netPnl} | Mid state (5-7): ${stats.byEmotion.mid.count} trades, ${stats.byEmotion.mid.winRate}% WR, $${stats.byEmotion.mid.netPnl} | High state (8-10): ${stats.byEmotion.high.count} trades, ${stats.byEmotion.high.winRate}% WR, $${stats.byEmotion.high.netPnl}`;

  const revengeSummary = stats.afterConsecutiveLosses
    .filter((r) => r.count >= 2)
    .map((r) => `After ${r.after} losses: ${r.count} trades, ${r.winRate}% WR, avg $${r.avgPnl}`)
    .join(" | ");

  const overtradeSummary = stats.byDailyTradeRank
    .map((r) => `Trade #${r.rank}: ${r.count} trades, ${r.winRate}% WR, avg $${r.avgPnl}`)
    .join(" | ");

  const holdSummary = stats.byHoldDuration
    .filter((h) => h.count >= 2)
    .map((h) => `${h.bucket}: ${h.count} trades, ${h.winRate}% WR, avg $${h.avgPnl}`)
    .join(" | ");

  const setupSummary = stats.bySetup
    .slice(0, 5)
    .map((s) => `${s.setup}: ${s.count} trades, ${s.winRate}% WR, $${s.netPnl} total`)
    .join(" | ");

  const mistakeSummary = stats.mistakeImpact
    .slice(0, 5)
    .map((m) => `${m.tag}: ${m.count}x, avg $${m.avgPnl}, total $${m.totalPnl}`)
    .join(" | ");

  const baselineWR = stats.baselineStats.winRate;

  const dataBlob = `
TRADER PROFILE: Account size $${user?.accountSize ?? "?"} | Risk/trade ${user?.riskPerTrade ?? 1}%

LAST 28 DAYS OVERVIEW
Total closed trades: ${stats.overall.count}
Net P&L: $${stats.overall.netPnl}
Win rate: ${stats.overall.winRate}%
Avg P&L/trade: $${stats.overall.avgPnl}
Commission drag: $${stats.commission.total} total (${stats.commission.asPercentOfGross}% of gross, $${stats.commission.perTrade}/trade)

DAY OF WEEK PERFORMANCE
${dowSummary || "Insufficient data per day"}

TIME OF DAY PERFORMANCE
${hourSummary || "Insufficient data per hour"}

EMOTIONAL STATE vs PERFORMANCE
${emotionSummary}
Note: Baseline win rate (after a winning trade): ${baselineWR}%

SEQUENTIAL LOSS BEHAVIOR (revenge trading detector)
${revengeSummary || "No clear sequential loss pattern detected"}
Baseline (after winning trade): ${stats.baselineStats.winRate}% WR, avg $${stats.baselineStats.avgPnl}

OVERTRADING DETECTOR (trades per day)
${overtradeSummary}

HOLD DURATION vs PERFORMANCE
${holdSummary}

SETUP PERFORMANCE
${setupSummary || "No setup tags recorded"}

MISTAKE TAG IMPACT (avg P&L when tagged)
${mistakeSummary || "No mistake tags recorded"}`.trim();

  const prompt = `You are an elite trading performance analyst running a weekly behavioral audit. Analyze the trader's last 28 days of behavioral data and identify exactly 5 specific, data-driven behavioral patterns affecting their P&L.

DATA:
${dataBlob}

Return ONLY a valid JSON object with this exact structure. No markdown, no explanation:

{
  "summary": "2-sentence executive summary of their biggest strength and biggest leak",
  "findings": [
    {
      "id": "unique-slug",
      "title": "Short pattern name (6 words max)",
      "category": "psychology" | "timing" | "setup" | "risk" | "overtrading",
      "severity": "high" | "medium" | "low",
      "dollarImpact": number (negative = costing money, positive = generating alpha, estimate over 4 weeks),
      "evidence": "The specific data point proving this. Quote exact numbers from the data above.",
      "description": "2-3 sentences explaining the pattern and why it matters.",
      "action": "One specific, immediate action to address this."
    }
  ]
}

Rules:
- Every finding MUST reference specific numbers from the data. No generic advice.
- Dollar impact should be a realistic estimate: if a pattern affects 20 trades at avg -$50 each, dollarImpact = -1000.
- Sort findings by abs(dollarImpact) descending — biggest money leaks first.
- Only generate a finding if the data clearly supports it (min 3-5 trade sample).
- If a category has no clear pattern, skip it and pick a stronger one.
- Be brutally honest. This is confidential coaching data.`;

  try {
    const model = user?.aiModel ?? "claude-sonnet-4-6";
    const response = await client.messages.create({
      model,
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const clean = text.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);

    const weekOf = startOfWeek(new Date());

    const digest = await prisma.behavioralDigest.create({
      data: {
        userId,
        weekOf,
        summary: parsed.summary,
        findings: parsed.findings,
        tradeCount: stats.overall.count,
        netPnl: stats.overall.netPnl,
      },
    });

    // Push notification to all user devices
    if (isPushConfigured()) {
      const subs = await prisma.pushSubscription.findMany({ where: { userId } });
      if (subs.length) {
        const topFinding = Array.isArray(parsed.findings) && parsed.findings[0];
        const body = topFinding
          ? `${topFinding.title} — ${topFinding.category}`
          : `${stats.overall.count} trades analyzed across 4 weeks`;
        await Promise.allSettled(
          subs.map((s) =>
            sendPushNotification(s, {
              title: "Weekly AI Digest Ready",
              body,
              url: "/ai-coach",
              tag: "weekly-digest",
            })
          )
        );
      }
    }

    return NextResponse.json({ configured: true, digest, cached: false });
  } catch (err) {
    console.error("Behavioral digest error:", err);
    return NextResponse.json({ configured: true, digest: null, error: "Failed to generate digest" }, { status: 500 });
  }
}
