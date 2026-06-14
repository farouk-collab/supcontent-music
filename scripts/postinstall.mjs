/**
 * After npm install, create junctions/symlinks so react-native lives in
 * apps/mobile/node_modules (Metro needs it there to resolve internal files).
 */
import { execSync } from "child_process";
import { existsSync, symlinkSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const mobileNM = path.join(root, "apps", "mobile", "node_modules");

// Packages that must live in apps/mobile/node_modules for Metro to work
const REQUIRED_LOCAL = ["react-native", "react"];

mkdirSync(mobileNM, { recursive: true });

for (const pkg of REQUIRED_LOCAL) {
  const src = path.join(root, "node_modules", pkg);
  const dest = path.join(mobileNM, pkg);

  if (!existsSync(src)) continue;
  if (existsSync(dest)) continue;

  try {
    if (process.platform === "win32") {
      execSync(`cmd /c mklink /J "${dest}" "${src}"`, { stdio: "pipe" });
    } else {
      symlinkSync(src, dest, "junction");
    }
    console.log(`  linked: apps/mobile/node_modules/${pkg} → node_modules/${pkg}`);
  } catch (e) {
    console.warn(`  warn: could not link ${pkg}: ${e.message}`);
  }
}
