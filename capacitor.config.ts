import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.edgelog.journal",
  appName: "EdgeLog",
  // webDir is required by Capacitor but not used in live-reload / remote-URL mode.
  // We always load from server.url so the app retains full SSR + API routes.
  webDir: "out",

  server: {
    // Set CAPACITOR_APP_URL in .env for production builds.
    // Leave unset in development — Capacitor will fall back to localhost:3000.
    url: process.env.CAPACITOR_APP_URL ?? "http://localhost:3000",
    cleartext: true, // required for plain-http in dev; TLS in prod disables this automatically
    allowNavigation: ["*.edgelog.app", "localhost"],
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0f1117",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },

    StatusBar: {
      style: "Dark",
      backgroundColor: "#0f1117",
      overlaysWebView: false,
    },
  },

  ios: {
    // Allows EdgeLog:// deep-link scheme
    scheme: "EdgeLog",
    backgroundColor: "#0f1117",
    contentInset: "always",
    // Minimum deployment target set in Xcode: 14.0
  },

  android: {
    backgroundColor: "#0f1117",
    allowMixedContent: true, // needed for http in dev
    captureInput: true,
    webContentsDebuggingEnabled: false, // flip to true for dev builds
  },
};

export default config;
