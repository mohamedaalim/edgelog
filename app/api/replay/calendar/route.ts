import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { subDays, format } from "date-fns";

export async function GET() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const from = subDays(new Date(), 180);

  const trades = await prisma.trade.findMany({
    where: { userId: userId!, entryTime: { gte: from } },
    select: { entryTime: true },
  });

  const dateSet = new Set<string>();
  for (const t of trades) {
    dateSet.add(format(t.entryTime, "yyyy-MM-dd"));
  }

  return NextResponse.json({ dates: Array.from(dateSet) });
}
