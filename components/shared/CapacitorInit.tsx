"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  hideSplash,
  styleStatusBar,
  registerNativePush,
  onForegroundPush,
  onNotificationTap,
  handleAndroidBack,
  getPlatform,
} from "@/lib/capacitor";

// Mounted once in the dashboard layout. Handles all native lifecycle concerns.
export function CapacitorInit() {
  const router = useRouter();

  useEffect(() => {
    let cleanupBack: (() => void) | undefined;
    let cleanupForeground: (() => void) | undefined;
    let cleanupTap: (() => void) | undefined;

    async function init() {
      // 1. Style status bar and hide splash
      await styleStatusBar();
      await hideSplash();

      // 2. Register for native push and save token to server
      const token = await registerNativePush();
      if (token) {
        const platform = await getPlatform();
        await fetch("/api/push/device-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, platform }),
        }).catch(() => {});
      }

      // 3. Foreground push — show a toast-like in-app banner instead of system notification
      cleanupForeground = await onForegroundPush((title, body, data) => {
        // Dispatch a custom event; the app can listen and render a toast
        window.dispatchEvent(
          new CustomEvent("capacitor-push", { detail: { title, body, url: data.url } })
        );
      });

      // 4. Notification tap — navigate to the linked URL
      cleanupTap = await onNotificationTap((url) => {
        // Strip origin if present so router handles relative paths
        try {
          const path = new URL(url).pathname + new URL(url).search;
          router.push(path);
        } catch {
          router.push(url.startsWith("/") ? url : `/${url}`);
        }
      });

      // 5. Android back button
      cleanupBack = await handleAndroidBack(() => false); // false = use default browser back
    }

    init().catch(console.error);

    return () => {
      cleanupForeground?.();
      cleanupTap?.();
      cleanupBack?.();
    };
  }, [router]);

  return null;
}
