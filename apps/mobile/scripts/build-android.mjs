import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const task = process.argv[2] || "assembleRelease";
const mobileRoot = path.resolve(import.meta.dirname, "..");
const androidRoot = path.join(mobileRoot, "android");
const gradleCommand = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const defaultSdk = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk")
  : "";
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || defaultSdk;

if (!androidHome || !existsSync(androidHome)) {
  console.error("Android SDK introuvable. Definissez ANDROID_HOME avant de relancer.");
  process.exit(1);
}

const result = spawnSync(gradleCommand, [task, "--no-daemon"], {
  cwd: androidRoot,
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || "production",
    ANDROID_HOME: androidHome,
    ANDROID_SDK_ROOT: androidHome,
  },
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
