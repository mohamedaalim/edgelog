"use client";

// All Capacitor plugin imports MUST be dynamic (inside async functions / useEffect).
// Importing them at the top level causes SSR failures in Next.js.

export async function isNative(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const { Capacitor } = await import("@capacitor/core");
  return Capacitor.isNativePlatform();
}

export async function getPlatform(): Promise<"ios" | "android" | "web"> {
  if (typeof window === "undefined") return "web";
  const { Capacitor } = await import("@capacitor/core");
  return Capacitor.getPlatform() as "ios" | "android" | "web";
}

// Hide the native splash screen after the app has painted.
export async function hideSplash(): Promise<void> {
  const native = await isNative();
  if (!native) return;
  const { SplashScreen } = await import("@capacitor/splash-screen");
  await SplashScreen.hide();
}

// Set status bar style (Dark = light text on dark bg).
export async function styleStatusBar(): Promise<void> {
  const native = await isNative();
  if (!native) return;
  const { StatusBar, Style } = await import("@capacitor/status-bar");
  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: "#0f1117" });
}

// Register for native push notifications and return the FCM/APNs token.
// Returns null on web or if permission denied.
export async function registerNativePush(): Promise<string | null> {
  const native = await isNative();
  if (!native) return null;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return null;

  return new Promise((resolve) => {
    const onRegistration = PushNotifications.addListener(
      "registration",
      (token) => {
        onRegistration.then((h) => h.remove()).catch(() => {});
        resolve(token.value);
      }
    );

    const onError = PushNotifications.addListener(
      "registrationError",
      () => {
        onError.then((h) => h.remove()).catch(() => {});
        resolve(null);
      }
    );

    PushNotifications.register().catch(() => resolve(null));
  });
}

// Listen for incoming push while app is in foreground (native only).
export async function onForegroundPush(
  handler: (title: string, body: string, data: Record<string, string>) => void
): Promise<() => void> {
  const native = await isNative();
  if (!native) return () => {};

  const { PushNotifications } = await import("@capacitor/push-notifications");
  const handle = await PushNotifications.addListener("pushNotificationReceived", (n) => {
    handler(n.title ?? "", n.body ?? "", (n.data ?? {}) as Record<string, string>);
  });
  return () => { handle.remove().catch(() => {}); };
}

// Listen for notification tap (app opened via notification).
export async function onNotificationTap(
  handler: (url: string) => void
): Promise<() => void> {
  const native = await isNative();
  if (!native) return () => {};

  const { PushNotifications } = await import("@capacitor/push-notifications");
  const handle = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const url = (action.notification.data as Record<string, string>)?.url ?? "/dashboard";
    handler(url);
  });
  return () => { handle.remove().catch(() => {}); };
}

// Handle Android back button — navigate back or exit app.
export async function handleAndroidBack(onBack: () => boolean): Promise<() => void> {
  const platform = await getPlatform();
  if (platform !== "android") return () => {};

  const { App } = await import("@capacitor/app");
  const handle = await App.addListener("backButton", ({ canGoBack }) => {
    if (!onBack()) {
      if (canGoBack) window.history.back();
      else App.exitApp();
    }
  });
  return () => { handle.remove().catch(() => {}); };
}
