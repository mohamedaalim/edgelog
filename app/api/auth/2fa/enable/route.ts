import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { verifySync } from "otplib";

export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });
  if (!user?.twoFactorSecret) return NextResponse.json({ error: "Run /setup first" }, { status: 400 });
  if (user.twoFactorEnabled) return NextResponse.json({ error: "Already enabled" }, { status: 400 });

  const { valid } = verifySync({ token: code, secret: user.twoFactorSecret, strategy: "totp" });
  if (!valid) return NextResponse.json({ error: "Invalid code — check your authenticator app" }, { status: 400 });

  await prisma.user.update({ where: { id: userId! }, data: { twoFactorEnabled: true } });
  return NextResponse.json({ ok: true });
}
