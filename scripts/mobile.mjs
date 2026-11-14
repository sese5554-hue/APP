import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { mobileServer } from "./mobile-config.mjs";
import { mobileAddress } from "./mobile-network.mjs";
import { resolveMobileSettings } from "./mobile-settings.mjs";

const [action = "sync", platform = "android"] = process.argv.slice(2);
if (!["sync", "open", "apk"].includes(action) || !["android", "ios"].includes(platform))
  throw new Error("사용법: node scripts/mobile.mjs sync|open|apk android|ios");
if (action === "apk" && platform !== "android") throw new Error("APK는 Android 전용입니다.");
if (action === "open" && platform === "ios" && process.platform !== "darwin")
  throw new Error("iOS 빌드와 실행은 macOS + Xcode에서 진행하세요.");
if (!process.env.MOBILE_SERVER_URL || process.argv.includes("--local")) {
  const settings = JSON.parse(readFileSync(`${platform}/test-settings.json`, "utf8"));
  if (process.argv.includes("--local")) settings.mode = "local";
  const resolved = resolveMobileSettings(settings, mobileAddress);
  process.env.MOBILE_SERVER_URL = resolved.url;
  process.env.MOBILE_ALLOW_HTTP = resolved.allowHttp;
}
console.log(`App test server: ${process.env.MOBILE_SERVER_URL}. Keep the PC server running on the same Wi-Fi.`);
if (!mobileServer(process.env.MOBILE_SERVER_URL, process.env.MOBILE_ALLOW_HTTP))
  throw new Error("MOBILE_SERVER_URL을 설정하세요. 예: https://서비스주소 (LAN 테스트는 MOBILE_ALLOW_HTTP=1도 설정)");
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run("npm", ["run", "build"]);
run("npx", ["--no-install", "cap", "sync", platform]);
if (platform === "ios") {
  // Debug builds can reach a changing LAN IP; release retains the strict base plist.
  const plist = readFileSync("ios/App/App/Info.plist", "utf8");
  const debugPlist = plist.replace(
    "<key>NSAllowsLocalNetworking</key>",
    "<key>NSAllowsArbitraryLoadsInWebContent</key><true/>\n    <key>NSAllowsLocalNetworking</key>",
  );
  writeFileSync("ios/App/App/Info-Debug.plist", debugPlist);
}
if (action === "open") run("npx", ["--no-install", "cap", "open", platform]);
if (action === "apk") {
  const portableTools = path.resolve(".runtime/android-tools");
  const portableJava = path.join(portableTools, "java");
  if (!process.env.JAVA_HOME && existsSync(portableJava)) {
    const jdk = readdirSync(portableJava).find(name => existsSync(path.join(portableJava, name, "bin/java.exe")));
    if (jdk) process.env.JAVA_HOME = path.join(portableJava, jdk);
  }
  if (!process.env.ANDROID_HOME && existsSync(path.join(portableTools, "sdk/platforms/android-36"))) {
    process.env.ANDROID_HOME = path.join(portableTools, "sdk");
    process.env.ANDROID_SDK_ROOT = process.env.ANDROID_HOME;
  }
  if (existsSync(path.join(portableTools, "gradle-cache")))
    process.env.GRADLE_USER_HOME ||= path.join(portableTools, "gradle-cache");
  if (!process.env.JAVA_HOME && !existsSync("C:/Program Files/Android/Android Studio/jbr"))
    throw new Error("JDK 21 이상이 필요합니다. Android Studio 설치 후 JAVA_HOME을 설정하세요.");
  if (!process.env.JAVA_HOME && process.platform === "win32")
    process.env.JAVA_HOME = "C:/Program Files/Android/Android Studio/jbr";
  run(process.platform === "win32" ? "android\\gradlew.bat" : "sh", process.platform === "win32"
    ? ["-p", "android", "assembleDebug"] : ["android/gradlew", "-p", "android", "assembleDebug"]);
  mkdirSync("releases", { recursive: true });
  copyFileSync("android/app/build/outputs/apk/debug/app-debug.apk", "releases/Geuncha-android-debug.apk");
  console.log("설치 파일: releases/Geuncha-android-debug.apk");
}
