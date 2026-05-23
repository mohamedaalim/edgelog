import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { MILESTONES, computeStats, evaluateMilestone, TIER_POINTS } from "@/lib/milestones";

export async function GET() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const [trades, journals, unlocked] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: userId!, status: "CLOSED" },
      select: { netPnl: true, grossPnl: true, commission: true, rRatio: true, entryTime: true, emotionBefore: true, setupType: true, playbookId: true, rulesFollowed: true },
      orderBy: { entryTime: "asc" },
    }),
    prisma.journalEntry.findMany({ where: { userId: userId! }, select: { date: true } }),
    prisma.userMilestone.findMany({ where: { userId: userId! } }),
  ]);

  const stats = computeStats(trades, journals.map((j) => j.date));
  const unlockedMap = new Map(unlocked.map((u) => [u.milestoneId, u.unlockedAt]));

  const milestones = MILESTONES.map((m) => {
    const unlockedAt = unlockedMap.get(m.id) ?? null;
    const earned = unlockedAt != null;
    // Progress value for milestones with a progressKey
    let progress: number | null = null;
    if (m.progressKey && m.threshold) {
      const val = stats[m.progressKey as keyof typeof stats] as number;
      progress = typeof val === "number" ? Math.min(val, m.threshold) : null;
    }
    return { ...m, earned, unlockedAt, progress };
  });

  const totalPoints = milestones.filter((m) => m.earned).reduce((s, m) => s + m.points, 0);
  const maxPoints = MILESTONES.reduce((s, m) => s + TIER_POINTS[m.tier], 0);

  return NextResponse.json({ milestones, stats, totalPoints, maxPoints });
}

export async function POST() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { checkMilestones } = await import("@/lib/milestones");
  const newlyUnlocked = await checkMilestones(userId!);

  return NextResponse.json({ newlyUnlocked });
}
