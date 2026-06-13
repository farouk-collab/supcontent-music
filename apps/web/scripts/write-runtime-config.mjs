import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "..", "dist", "noyau");
const outputPath = path.resolve(distDir, "runtime-config.json");

const apiBase = String(process.env.SUPCONTENT_API_BASE || "https://supcontent-music-api-zivr.onrender.com").trim();

await mkdir(distDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ apiBase }, null, 2)}\n`, "utf8");

console.log(`runtime-config written to ${outputPath}`);
