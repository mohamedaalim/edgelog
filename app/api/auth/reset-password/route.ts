import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const rl = rateLimit(`reset-password:${ip}`, 5, 900); // 5 per 15 min per IP
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  const { token, newPassword } = await req.json();
  if (!token || !newPassword) return NextResponse.json({ error: "token and newPassword required" }, { status: 400 });
  if (newPassword.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record || record.used) return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  if (record.expiresAt < new Date()) return NextResponse.json({ error: "Reset link has expired — please request a new one" }, { status: 400 });

  const hashed = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { token }, data: { used: true } }),
  ]);

  return NextResponse.json({ ok: true });
}
