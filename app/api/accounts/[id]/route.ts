import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.account.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, broker, accountNumber, accountType, initialBalance, currentBalance, currency, commission, commissionType, isDefault, isActive } = await req.json();

  if (isDefault) {
    await prisma.account.updateMany({ where: { userId: userId! }, data: { isDefault: false } });
  }

  const account = await prisma.account.update({
    where: { id },
    data: {
      name: name?.trim() ?? undefined,
      broker: broker !== undefined ? (broker || null) : undefined,
      accountNumber: accountNumber !== undefined ? (accountNumber || null) : undefined,
      accountType: accountType ?? undefined,
      initialBalance: initialBalance ?? undefined,
      currentBalance: currentBalance ?? undefined,
      currency: currency ?? undefined,
      commission: commission ?? undefined,
      commissionType: commissionType ?? undefined,
      isDefault: isDefault ?? undefined,
      isActive: isActive ?? undefined,
    },
  });

  return NextResponse.json(account);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.account.findUnique({
    where: { id },
    select: { userId: true, isDefault: true, _count: { select: { trades: true } } },
  });
  if (!existing || existing.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing._count.trades > 0) return NextResponse.json({ error: `Cannot delete — account has ${existing._count.trades} trades linked to it` }, { status: 409 });

  await prisma.account.delete({ where: { id } });

  // If deleted account was default, promote the next one
  if (existing.isDefault) {
    const next = await prisma.account.findFirst({ where: { userId: userId! }, orderBy: { createdAt: "asc" } });
    if (next) await prisma.account.update({ where: { id: next.id }, data: { isDefault: true } });
  }

  return NextResponse.json({ ok: true });
}
