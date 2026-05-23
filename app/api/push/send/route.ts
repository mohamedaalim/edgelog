import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import {
  sendPushNotification,
  isPushConfigured,
  sendFcmToUser,
  isFcmConfigured,
  type PushPayload,
} from "@/lib/webpush";

// POST /api/push/send — send to all web and native subscriptions for the calling user
export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const payload: PushPayload = {
    title: body.title ?? "EdgeLog",
    body: body.body ?? "Test notification",
    url: body.url ?? "/dashboard",
    tag: body.tag ?? "test",
  };

  let webSent = 0;
  let nativeSent = 0;

  // ── Web push (PWA / browser) ─────────────────────────────────────────────
  if (isPushConfigured()) {
    const subs = await prisma.pushSubscription.findMany({ where: { userId: userId! } });

    const results = await Promise.allSettled(
      subs.map((sub) => sendPushNotification(sub, payload))
    );

    const expired: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const err = r.reason as { statusCode?: number };
        if (err.statusCode === 410) expired.push(subs[i].endpoint);
      }
    });
    if (expired.length) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: expired } } });
    }
    webSent = results.filter((r) => r.status === "fulfilled").length;
  }

  // ── Native push (FCM → iOS APNs + Android) ──────────────────────────────
  if (isFcmConfigured()) {
    const { sent } = await sendFcmToUser(userId!, payload);
    nativeSent = sent;
  }

  const total = webSent + nativeSent;
  if (total === 0 && !isPushConfigured() && !isFcmConfigured()) {
    return NextResponse.json({ error: "No push provider configured (VAPID or FIREBASE_SERVER_KEY)" }, { status: 503 });
  }

  return NextResponse.json({ sent: total, web: webSent, native: nativeSent });
}
