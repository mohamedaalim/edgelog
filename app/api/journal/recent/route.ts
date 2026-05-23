import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function GET() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const entries = await prisma.journalEntry.findMany({
    where: { userId: userId! },
    orderBy: { date: "desc" },
    take: 30,
    select: {
      id: true, date: true, dailyPnl: true, dailyWins: true,
      dailyLosses: true, grade: true, mood: true, adherenceScore: true,
      marketBias: true, tags: true,
    },
  });

  return NextResponse.json(entries);
}
