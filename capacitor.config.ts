import type { CapacitorConfig } from "@capacitor/cli";
import { mobileServer } from "./scripts/mobile-config.mjs";

const config: CapacitorConfig = {
  appId: "com.geuncha.app",
  appName: "근차",
  webDir: "dist/web",
  server: mobileServer(process.env.MOBILE_SERVER_URL, process.env.MOBILE_ALLOW_HTTP),
  android: { allowMixedContent: false },
  ios: { contentInset: "automatic" },
};
export default config;
