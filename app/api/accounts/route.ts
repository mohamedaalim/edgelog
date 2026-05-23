import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function GET() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const accounts = await prisma.account.findMany({
    where: { userId: userId!, isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true, name: true, broker: true, accountType: true, isDefault: true,
      currency: true, initialBalance: true, currentBalance: true,
      accountNumber: true, commission: true, commissionType: true, createdAt: true,
      _count: { select: { trades: true } },
    },
  });

  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { name, broker, accountNumber, accountType, initialBalance, currency, commission, commissionType, isDefault } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const account = await prisma.$transaction(async (tx) => {
    const existingCount = await tx.account.count({ where: { userId: userId! } });
    const shouldBeDefault = isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await tx.account.updateMany({ where: { userId: userId! }, data: { isDefault: false } });
    }

    return tx.account.create({
      data: {
        userId: userId!, name: name.trim(),
        broker: broker ?? null, accountNumber: accountNumber ?? null,
        accountType: accountType ?? "LIVE",
        initialBalance: initialBalance ?? 0,
        currentBalance: initialBalance ?? 0,
        currency: currency ?? "USD",
        commission: commission ?? 0,
        commissionType: commissionType ?? "per_trade",
        isDefault: shouldBeDefault,
      },
    });
  });

  return NextResponse.json(account, { status: 201 });
}
