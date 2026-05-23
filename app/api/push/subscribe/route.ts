import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

// POST /api/push/subscribe — save a push subscription
export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { endpoint, keys, userAgent } = await req.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: userId!,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    },
    update: {
      userId: userId!,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/push/subscribe — remove a subscription
export async function DELETE(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: userId! },
  });

  return NextResponse.json({ ok: true });
}

// GET /api/push/subscribe — check if current browser is subscribed
export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint");

  if (endpoint) {
    const sub = await prisma.pushSubscription.findFirst({
      where: { endpoint, userId: userId! },
      select: { id: true },
    });
    return NextResponse.json({ subscribed: !!sub });
  }

  const count = await prisma.pushSubscription.count({ where: { userId: userId! } });
  return NextResponse.json({ count });
}
