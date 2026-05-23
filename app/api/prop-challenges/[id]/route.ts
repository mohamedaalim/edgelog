import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const challenge = await prisma.propChallenge.findFirst({ where: { id, userId: userId! } });
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.propChallenge.update({
    where: { id },
    data: {
      status:    body.status    ?? undefined,
      phase:     body.phase     ?? undefined,
      notes:     body.notes     ?? undefined,
      endDate:   body.endDate   ? new Date(body.endDate) : undefined,
      accountId: body.accountId ?? undefined,
      currentEquity: body.currentEquity ?? undefined,
      highWaterMark: body.highWaterMark ?? undefined,
      tradingDaysCount: body.tradingDaysCount ?? undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const challenge = await prisma.propChallenge.findFirst({ where: { id, userId: userId! } });
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.propChallenge.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
