import { spawn } from "node:child_process";

const port = 1234;
const healthUrl = `http://127.0.0.1:${port}/health`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function existingApiLooksHealthy() {
  try {
    const response = await fetch(healthUrl, { method: "GET" });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => null);
    return Boolean(payload?.ok);
  } catch {
    return false;
  }
}

async function keepAliveHolder() {
  console.log(`supcontent api already running on http://127.0.0.1:${port} - reusing existing instance`);
  for (;;) {
    await sleep(60_000);
  }
}

async function main() {
  if (await existingApiLooksHealthy()) {
    await keepAliveHolder();
    return;
  }

  const child = spawn("npm", ["--workspace", "apps/api", "run", "dev"], {
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
