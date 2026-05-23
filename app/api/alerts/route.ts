import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

// GET — current alert preferences
export async function GET() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { emailAlerts: true, alertEmail: true, alertDrawdownPct: true, alertDailyRecap: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    emailAlerts: user.emailAlerts,
    alertEmail: user.alertEmail ?? user.email,
    alertDrawdownPct: user.alertDrawdownPct,
    alertDailyRecap: user.alertDailyRecap,
  });
}

// PUT — update alert preferences
export async function PUT(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { emailAlerts, alertEmail, alertDrawdownPct, alertDailyRecap } = await req.json();

  const user = await prisma.user.update({
    where: { id: userId! },
    data: {
      emailAlerts: emailAlerts ?? undefined,
      alertEmail: alertEmail ?? undefined,
      alertDrawdownPct: alertDrawdownPct ?? undefined,
      alertDailyRecap: alertDailyRecap ?? undefined,
    },
    select: { emailAlerts: true, alertEmail: true, alertDrawdownPct: true, alertDailyRecap: true, email: true },
  });

  return NextResponse.json({
    emailAlerts: user.emailAlerts,
    alertEmail: user.alertEmail ?? user.email,
    alertDrawdownPct: user.alertDrawdownPct,
    alertDailyRecap: user.alertDailyRecap,
  });
}
