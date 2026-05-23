"use client";

import { useState, useEffect, useCallback } from "react";

export type PushState = "unsupported" | "denied" | "granted" | "default" | "loading";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer;
}

async function isNativePlatform(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    isNativePlatform().then(setIsNative);
  }, []);

  // Web push state detection
  useEffect(() => {
    if (isNative) {
      // Native: treat as granted once CapacitorInit has registered; show "enabled"
      setState("granted");
      // Check if we have a stored token for this device (proxy: server has at least 1 device token)
      fetch("/api/push/device-token").then((r) => r.json())
        .then((d) => setIsSubscribed(d.count > 0))
        .catch(() => {});
      return;
    }

    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as PushState);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => {});
  }, [isNative]);

  // ── Subscribe ───────────────────────────────────────────────────────────────
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (isNative) {
      // On native, CapacitorInit handles registration automatically.
      // Re-trigger manually if user taps enable in settings.
      setIsRegistering(true);
      try {
        const { registerNativePush, getPlatform } = await import("@/lib/capacitor");
        const token = await registerNativePush();
        if (!token) return false;
        const platform = await getPlatform();
        await fetch("/api/push/device-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, platform }),
        });
        setIsSubscribed(true);
        setState("granted");
        return true;
      } catch {
        return false;
      } finally {
        setIsRegistering(false);
      }
    }

    // Web push
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return false;

    setIsRegistering(true);
    try {
      const permission = await Notification.requestPermission();
      setState(permission as PushState);
      if (permission !== "granted") return false;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent }),
      });

      setIsSubscribed(true);
      return true;
    } catch {
      return false;
    } finally {
      setIsRegistering(false);
    }
  }, [isNative]);

  // ── Unsubscribe ─────────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async (): Promise<void> => {
    if (isNative) {
      // On native we can't revoke the APNs/FCM token programmatically.
      // Remove from server so we stop sending to this device.
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const { Capacitor } = await import("@capacitor/core");
      // Get the current token by re-registering (it's idempotent)
      return new Promise((resolve) => {
        PushNotifications.addListener("registration", async (t) => {
          await fetch("/api/push/device-token", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: t.value }),
          }).catch(() => {});
          setIsSubscribed(false);
          resolve();
        }).catch(() => resolve());
        PushNotifications.register().catch(() => resolve());
        void Capacitor; // suppress unused import warning
      });
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      setIsSubscribed(false);
    } catch { /* ignore */ }
  }, [isNative]);

  // ── Test notification ───────────────────────────────────────────────────────
  const sendTest = useCallback(async () => {
    return fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "EdgeLog Test", body: "Push notifications are working!", url: "/dashboard", tag: "test" }),
    }).then((r) => r.json());
  }, []);

  return { state, isSubscribed, isRegistering, isNative, subscribe, unsubscribe, sendTest };
}
