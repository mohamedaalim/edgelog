import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { sendMail, isMailConfigured, buildPasswordResetEmail } from "@/lib/mailer";
import { rateLimit, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const rl = rateLimit(`forgot:${ip}`, 5, 900); // 5 per 15 min per IP
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  const { email } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "email required" }, { status: 400 });

  // Always return success — never reveal whether email exists (security)
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return NextResponse.json({ ok: true });

  // Expire any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  if (isMailConfigured()) {
    const appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    const html = buildPasswordResetEmail({
      name: user.name ?? "Trader",
      resetUrl,
      expiresIn: "2 hours",
    });
    await sendMail({ to: user.email, subject: "EdgeLog — Reset your password", html });
  }

  return NextResponse.json({ ok: true });
}
