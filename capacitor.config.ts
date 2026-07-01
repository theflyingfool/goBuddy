import type { CapacitorConfig } from "@capacitor/core";

// appId is a reverse-domain identifier, not a real registered domain — fine
// for a local-only sideloaded app (never published to the Play Store).
// Change it if you'd rather use your own convention before building a real APK.
const config: CapacitorConfig = {
  appId: "com.theflyingfool.pogobuddy",
  appName: "PoGo Buddy",
  webDir: "dist",
};

export default config;
