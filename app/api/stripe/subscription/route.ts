import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function GET() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const sub = await prisma.subscription.findUnique({
    where: { userId: userId! },
    select: { plan: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
  });

  if (!sub || sub.plan === "FREE") {
    return NextResponse.json({ plan: "FREE", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false });
  }

  return NextResponse.json(sub);
}
