import { Capacitor } from "@capacitor/core";

// Install once outside React so StrictMode cannot duplicate native listeners.
export async function initializeMobile() {
  if (Capacitor.getPlatform() !== "android") return;
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });
}
