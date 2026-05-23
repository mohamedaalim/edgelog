import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { sendMail, isMailConfigured, buildDailyDigestEmail } from "@/lib/mailer";
import { format } from "date-fns";

export async function POST() {
  const { userId, error } = await requireSession();
  if (error) return error;

  if (!isMailConfigured()) {
    return NextResponse.json({ error: "SMTP not configured — add SMTP_HOST, SMTP_USER, SMTP_PASS to .env" }, { status: 503 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { name: true, email: true, alertEmail: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const to = user.alertEmail ?? user.email;
  const html = buildDailyDigestEmail({
    name: user.name ?? "Trader",
    date: format(new Date(), "EEEE, MMMM d, yyyy"),
    totalPnl: 342.5,
    trades: 7,
    winRate: 71.4,
    bestTrade: 215.0,
    worstTrade: -48.0,
    cumulativePnl: 12430.0,
  });

  await sendMail({ to, subject: "EdgeLog — Test Email ✓", html });
  return NextResponse.json({ ok: true, sentTo: to });
}
