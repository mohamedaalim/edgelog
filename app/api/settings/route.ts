import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function GET() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { id: true, name: true, email: true, image: true, timezone: true, currency: true, accountSize: true, riskPerTrade: true, aiModel: true, twoFactorEnabled: true, createdAt: true },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ ...user, aiConfigured: !!process.env.ANTHROPIC_API_KEY });
}

export async function PUT(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { name, email, timezone, currency, accountSize, riskPerTrade, aiModel } = await req.json();

  // If email is changing, check it isn't taken
  if (email) {
    const conflict = await prisma.user.findFirst({ where: { email, NOT: { id: userId! } } });
    if (conflict) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const VALID_MODELS = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7"];

  const user = await prisma.user.update({
    where: { id: userId! },
    data: {
      name: name?.trim() ?? undefined,
      email: email?.trim().toLowerCase() ?? undefined,
      timezone: timezone ?? undefined,
      currency: currency ?? undefined,
      accountSize: accountSize != null ? parseFloat(accountSize) : undefined,
      riskPerTrade: riskPerTrade != null ? parseFloat(riskPerTrade) : undefined,
      aiModel: aiModel && VALID_MODELS.includes(aiModel) ? aiModel : undefined,
    },
    select: { id: true, name: true, email: true, image: true, timezone: true, currency: true, accountSize: true, riskPerTrade: true, aiModel: true },
  });

  return NextResponse.json(user);
}
