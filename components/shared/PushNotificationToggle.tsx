"use client";

import { Bell, BellOff, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { usePushNotifications } from "@/lib/usePushNotifications";
import { cn } from "@/lib/utils";

export function PushNotificationToggle() {
  const { state, isSubscribed, isRegistering, subscribe, unsubscribe, sendTest } = usePushNotifications();

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking notification status…
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <AlertTriangle className="w-4 h-4" />
        Push notifications not supported in this browser
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
        <div className="flex items-center gap-2 text-yellow-400 font-medium mb-1">
          <AlertTriangle className="w-4 h-4" />
          Notifications blocked
        </div>
        <p className="text-yellow-200/70 text-xs">
          You&apos;ve blocked notifications for this site. To enable them, click the lock icon
          in your browser&apos;s address bar and allow notifications, then reload.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            isSubscribed ? "bg-[var(--green-dim)]" : "bg-white/5"
          )}>
            {isSubscribed ? (
              <Bell className="w-4 h-4 text-[var(--green)]" />
            ) : (
              <BellOff className="w-4 h-4 text-[var(--muted)]" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {isSubscribed ? "Notifications enabled" : "Enable push notifications"}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {isSubscribed
                ? "You'll receive alerts for weekly digest and daily limits"
                : "Get weekly AI digest, daily loss alerts, and milestone notifications"}
            </p>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isRegistering}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50",
            isSubscribed ? "bg-[var(--accent)]" : "bg-white/10"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
              isSubscribed ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {isSubscribed && (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--green)] shrink-0" />
          <span className="text-xs text-[var(--muted)]">Active on this device</span>
          <button
            onClick={sendTest}
            className="ml-auto text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
          >
            Send test
          </button>
        </div>
      )}

      {isRegistering && (
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Requesting permission…
        </div>
      )}
    </div>
  );
}
