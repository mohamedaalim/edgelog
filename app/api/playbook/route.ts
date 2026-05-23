import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function GET(_req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const playbooks = await prisma.playbook.findMany({
    where: { userId: userId! },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const playbookIds = playbooks.map((p) => p.id);

  const [totals, winnerGroups, adherentGroups] = await Promise.all([
    prisma.trade.groupBy({
      by: ["playbookId"],
      where: { userId: userId!, status: "CLOSED", playbookId: { in: playbookIds } },
      _count: { id: true },
      _sum: { netPnl: true, rRatio: true },
    }),
    prisma.trade.groupBy({
      by: ["playbookId"],
      where: { userId: userId!, status: "CLOSED", playbookId: { in: playbookIds }, netPnl: { gt: 0 } },
      _count: { id: true },
    }),
    prisma.trade.groupBy({
      by: ["playbookId"],
      where: { userId: userId!, status: "CLOSED", playbookId: { in: playbookIds }, rulesFollowed: true },
      _count: { id: true },
    }),
  ]);

  const totalsMap = new Map(totals.map((r) => [r.playbookId, r]));
  const winnersMap = new Map(winnerGroups.map((r) => [r.playbookId, r._count.id]));
  const adherentMap = new Map(adherentGroups.map((r) => [r.playbookId, r._count.id]));

  const data = playbooks.map((pb) => {
    const agg = totalsMap.get(pb.id);
    const count = agg?._count.id ?? 0;
    const winners = winnersMap.get(pb.id) ?? 0;
    const netPnl = agg?._sum.netPnl ?? 0;
    const rSum = agg?._sum.rRatio ?? 0;
    const avgR = count > 0 ? rSum / count : 0;
    const adherence = count > 0 ? ((adherentMap.get(pb.id) ?? 0) / count) * 100 : null;
    return {
      id: pb.id, name: pb.name, description: pb.description, setupType: pb.setupType,
      assetClass: pb.assetClass, timeframes: pb.timeframes, tags: pb.tags,
      isActive: pb.isActive, createdAt: pb.createdAt, updatedAt: pb.updatedAt,
      stats: { tradeCount: count, winners, winRate: count > 0 ? (winners / count) * 100 : 0, netPnl, avgR, adherence },
    };
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const { name, description, setupType, assetClass, timeframes, entryRules, exitRules, riskRules, tags, isActive } = body;

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const playbook = await prisma.playbook.create({
    data: {
      userId: userId!, name: name.trim(), description: description ?? null,
      setupType: setupType ?? null, assetClass: assetClass ?? [],
      timeframes: timeframes ?? [], entryRules: entryRules ?? null,
      exitRules: exitRules ?? null, riskRules: riskRules ?? null,
      tags: tags ?? [], isActive: isActive ?? true,
    },
  });

  return NextResponse.json(playbook, { status: 201 });
}
