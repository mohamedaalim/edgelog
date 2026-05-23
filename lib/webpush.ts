import webpush from "web-push";

let configured = false;

function configure() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL ?? "mailto:admin@edgelog.app";
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails(email, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<void> {
  configure();
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon ?? "/icons/icon-192.png",
      badge: payload.badge ?? "/icons/icon-192.png",
      url: payload.url ?? "/dashboard",
      tag: payload.tag,
    })
  );
}

export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

// ── FCM (native iOS / Android via Firebase Cloud Messaging) ──────────────────
// Requires FIREBASE_SERVER_KEY in .env (Firebase Console → Project Settings → Cloud Messaging → Server key)
// Handles both Android (FCM direct) and iOS (FCM → APNs relay).

export function isFcmConfigured(): boolean {
  return !!process.env.FIREBASE_SERVER_KEY;
}

export async function sendFcmNotification(
  deviceToken: string,
  payload: PushPayload
): Promise<void> {
  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey) throw new Error("FIREBASE_SERVER_KEY not set");

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${serverKey}`,
    },
    body: JSON.stringify({
      to: deviceToken,
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon ?? "/icons/icon-192.png",
        badge: payload.badge ?? "/icons/icon-192.png",
        tag: payload.tag,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      data: {
        url: payload.url ?? "/dashboard",
        tag: payload.tag ?? "",
      },
      // iOS-specific overrides
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: "default",
            "mutable-content": 1,
          },
        },
        fcm_options: {
          image: `${appUrl}/icons/icon-192.png`,
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FCM error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.failure > 0) {
    const err = json.results?.[0]?.error;
    if (err === "NotRegistered" || err === "InvalidRegistration") {
      throw Object.assign(new Error(`FCM token invalid: ${err}`), { expired: true });
    }
    throw new Error(`FCM send failed: ${err}`);
  }
}

// Send to all stored device tokens for a user, pruning stale ones automatically.
export async function sendFcmToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; pruned: number }> {
  if (!isFcmConfigured()) return { sent: 0, pruned: 0 };

  const { prisma } = await import("@/lib/prisma");
  const tokens = await prisma.deviceToken.findMany({ where: { userId } });
  if (!tokens.length) return { sent: 0, pruned: 0 };

  let sent = 0;
  const stale: string[] = [];

  await Promise.allSettled(
    tokens.map(async (dt) => {
      try {
        await sendFcmNotification(dt.token, payload);
        sent++;
      } catch (e: unknown) {
        if ((e as { expired?: boolean }).expired) stale.push(dt.token);
      }
    })
  );

  if (stale.length) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: stale } } });
  }

  return { sent, pruned: stale.length };
}
