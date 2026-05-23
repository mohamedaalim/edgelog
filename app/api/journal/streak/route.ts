import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { differenceInCalendarDays, subDays, startOfDay } from "date-fns";

export async function GET() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const entries = await prisma.journalEntry.findMany({
    where: { userId: userId! },
    select: { date: true },
    orderBy: { date: "desc" },
  });

  if (entries.length === 0) return NextResponse.json({ streak: 0, totalEntries: 0 });

  let streak = 0;
  let check = startOfDay(new Date());

  for (const entry of entries) {
    const entryDate = startOfDay(new Date(entry.date));
    const diff = differenceInCalendarDays(check, entryDate);
    if (diff === 0 || diff === 1) {
      streak++;
      check = entryDate;
    } else {
      break;
    }
  }

  // Get calendar data for last 6 months (for heatmap coloring)
  const sixMonthsAgo = subDays(new Date(), 180);
  const recentEntries = await prisma.journalEntry.findMany({
    where: { userId: userId!, date: { gte: sixMonthsAgo } },
    select: { date: true, dailyPnl: true, dailyWins: true, dailyLosses: true, grade: true },
  });

  return NextResponse.json({ streak, totalEntries: entries.length, calendarData: recentEntries });
}
