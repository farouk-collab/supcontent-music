import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(scriptDir, "..");
const androidDir = path.join(mobileDir, "android");
const metroPort = "8081";
const apiPort = "1234";

function resolveAndroidSdkPath() {
  const envCandidates = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
  ].filter(Boolean);

  for (const candidate of envCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const localPropsPath = path.join(androidDir, "local.properties");
  if (fs.existsSync(localPropsPath)) {
    const content = fs.readFileSync(localPropsPath, "utf8");
    const match = content.match(/^sdk\.dir=(.+)$/m);
    if (match) {
      const sdkDir = match[1].trim().replace(/\\:/g, ":").replace(/\\\\/g, "\\");
      if (fs.existsSync(sdkDir)) return sdkDir;
    }
  }

  const defaultSdk = path.join(os.homedir(), "AppData", "Local", "Android", "Sdk");
  if (fs.existsSync(defaultSdk)) return defaultSdk;

  throw new Error("Android SDK introuvable. Vérifie ANDROID_SDK_ROOT ou apps/mobile/android/local.properties.");
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed (${code})\n${stderr || stdout}`));
    });
  });
}

async function configureDevice(adbPath, serial) {
  const baseArgs = ["-s", serial];
  await runCommand(adbPath, [...baseArgs, "reverse", `tcp:${metroPort}`, `tcp:${metroPort}`]);
  await runCommand(adbPath, [...baseArgs, "reverse", `tcp:${apiPort}`, `tcp:${apiPort}`]);
  console.log(`Android prêt sur ${serial}: reverse ${metroPort}/${apiPort} configuré.`);
}

async function main() {
  const sdkPath = resolveAndroidSdkPath();
  const adbPath = path.join(sdkPath, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");

  if (!fs.existsSync(adbPath)) {
    throw new Error(`adb introuvable: ${adbPath}`);
  }

  await runCommand(adbPath, ["start-server"]);
  const { stdout } = await runCommand(adbPath, ["devices"]);
  const devices = stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts[1] === "device")
    .map((parts) => parts[0]);

  if (devices.length === 0) {
    console.warn("Aucun appareil Android connecté. Le serveur Expo va démarrer quand même.");
  } else {
    for (const serial of devices) {
      await configureDevice(adbPath, serial);
      console.log(`Android prêt sur ${serial}: Metro et API redirigés vers localhost.`);
    }
  }

  const expoBin = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(expoBin, ["expo", "start", "--dev-client"], {
    cwd: mobileDir,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || `http://localhost:${apiPort}`,
    },
    shell: process.platform === "win32",
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
