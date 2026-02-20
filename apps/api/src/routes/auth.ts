import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

import { pool } from "../connections";
import { findUserByEmail, createUser } from "../db/users";
import {
  storeRefreshToken,
  findRefreshToken,
  deleteRefreshTokensForUser,
} from "../db/refreshTokens";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../auth/jwt";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";

/* =========================
   Router
========================= */
const router = Router();
const GITHUB_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const oauthStateStore = new Map<string, number>();

/* =========================
   Schemas
========================= */
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Le mot de passe doit contenir une majuscule")
    .regex(/[a-z]/, "Le mot de passe doit contenir une minuscule")
    .regex(/[0-9]/, "Le mot de passe doit contenir un chiffre")
    .regex(/[^A-Za-z0-9]/, "Le mot de passe doit contenir un caractère spécial"),
  displayName: z.string().min(2).max(30),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * PATCH /auth/me
 * snake_case (comme ton profile.js)
 */
const UpdateMeSchema = z.object({
  display_name: z.string().min(2).max(30).optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  bio: z.string().max(160).optional(),

  website: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  location: z.string().max(80).optional(),

  gender: z.enum(["male", "female", "other", "prefer_not_to_say", ""]).optional(),
  birth_date: z.union([z.string(), z.literal(""), z.null()]).optional(), // YYYY-MM-DD / "" / null

  avatar_url: z
    .union([z.string().url(), z.string().regex(/^\/uploads\/[A-Za-z0-9._-]+$/), z.literal(""), z.null()])
    .optional(),
  cover_url: z
    .union([z.string().url(), z.string().regex(/^\/uploads\/[A-Za-z0-9._-]+$/), z.literal(""), z.null()])
    .optional(),
});

/* =========================
   Utils
========================= */
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function newOauthState() {
  const state = crypto.randomBytes(24).toString("hex");
  oauthStateStore.set(state, Date.now());
  return state;
}

function consumeOauthState(state: string) {
  const createdAt = oauthStateStore.get(state);
  if (!createdAt) return false;
  oauthStateStore.delete(state);
  return Date.now() - createdAt <= GITHUB_OAUTH_STATE_TTL_MS;
}

function cleanupOauthStates() {
  const now = Date.now();
  for (const [s, createdAt] of oauthStateStore.entries()) {
    if (now - createdAt > GITHUB_OAUTH_STATE_TTL_MS) oauthStateStore.delete(s);
  }
}

function ensureUploadsDir() {
  const dir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Parse un body multipart/form-data simple (1 fichier max)
 * Sans dépendance externe.
 * ⚠️ Suffisant pour ton MVP, mais pas "parfait" pour prod.
 */
async function parseMultipart(req: any): Promise<{ file?: { filename: string; mime: string; buffer: Buffer } }> {
  const contentType = req.headers["content-type"] || "";
  const match = /boundary=(.+)$/.exec(contentType);
  if (!match) return {};
  const boundary = "--" + match[1];

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks);

  const parts = body.toString("binary").split(boundary).slice(1, -1);
  for (const p of parts) {
    const part = p.trim();
    if (!part) continue;

    const [rawHeaders, rawData] = part.split("\r\n\r\n");
    if (!rawHeaders || !rawData) continue;

    const headers = rawHeaders.split("\r\n");
    const dispo = headers.find((h) => h.toLowerCase().startsWith("content-disposition")) || "";
    const type = headers.find((h) => h.toLowerCase().startsWith("content-type")) || "";

    // name="file"; filename="xxx.png"
    const nameMatch = /name="([^"]+)"/.exec(dispo);
    const fileMatch = /filename="([^"]+)"/.exec(dispo);

    const fieldName = nameMatch?.[1];
    const filename = fileMatch?.[1];

    if (fieldName === "file" && filename) {
      const mime = type.split(":")[1]?.trim() || "application/octet-stream";
      // rawData contient aussi \r\n-- fin => on coupe le trailing \r\n
      const bin = rawData.replace(/\r\n$/, "");
      const buffer = Buffer.from(bin, "binary");
      return { file: { filename, mime, buffer } };
    }
  }

  return {};
}

function extFromMime(mime: string) {
  const m = mime.toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  if (m.includes("webp")) return ".webp";
  return "";
}

/* =========================
   Routes
========================= */

router.get("/ping", (_req, res) => res.json({ ok: true }));

router.get("/oauth/github/start", (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri =
    process.env.GITHUB_REDIRECT_URI || "http://localhost:1234/auth/oauth/github/callback";

  if (!clientId) {
    return res.status(503).json({ erreur: "GITHUB_CLIENT_ID manquant" });
  }

  cleanupOauthStates();
  const state = newOauthState();
  const returnTo =
    typeof req.query.returnTo === "string" && req.query.returnTo.trim()
      ? req.query.returnTo.trim()
      : process.env.FRONTEND_URL || "http://localhost:4173";

  const payload = Buffer.from(JSON.stringify({ returnTo }), "utf8").toString("base64url");
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state: `${state}.${payload}`,
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${query.toString()}`);
});

router.get("/oauth/github/callback", async (req, res) => {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri =
      process.env.GITHUB_REDIRECT_URI || "http://localhost:1234/auth/oauth/github/callback";
    if (!clientId || !clientSecret) {
      return res.status(503).json({ erreur: "OAuth GitHub non configuré" });
    }

    const code = String(req.query.code || "");
    const stateRaw = String(req.query.state || "");
    const [state, encodedPayload] = stateRaw.split(".", 2);
    if (!code || !state || !consumeOauthState(state)) {
      return res.status(400).json({ erreur: "State OAuth invalide ou expiré" });
    }

    let returnTo = process.env.FRONTEND_URL || "http://localhost:4173";
    try {
      if (encodedPayload) {
        const decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
        if (decoded?.returnTo && typeof decoded.returnTo === "string") {
          returnTo = decoded.returnTo;
        }
      }
    } catch {
      // fallback to FRONTEND_URL
    }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenRes.ok || !tokenData?.access_token) {
      return res.status(401).json({ erreur: "Échec échange token GitHub", details: tokenData });
    }

    const ghToken = tokenData.access_token;
    const [userRes, emailsRes] = await Promise.all([
      fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "supcontent-music",
        },
      }),
      fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "supcontent-music",
        },
      }),
    ]);

    const ghUser = (await userRes.json()) as {
      id?: number;
      login?: string;
      name?: string;
      email?: string | null;
      avatar_url?: string;
    };
    const ghEmails = (await emailsRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;

    const chosenEmail =
      ghUser?.email ||
      ghEmails?.find((e) => e.primary && e.verified)?.email ||
      ghEmails?.find((e) => e.verified)?.email ||
      ghEmails?.[0]?.email ||
      "";
    if (!chosenEmail) {
      return res.status(400).json({ erreur: "Aucun email GitHub exploitable" });
    }

    const displayName = String(ghUser?.name || ghUser?.login || "GitHub User").slice(0, 30);

    let user = await findUserByEmail(chosenEmail);
    if (!user) {
      const randomPassword = crypto.randomBytes(24).toString("hex");
      const password_hash = await bcrypt.hash(randomPassword, 12);
      const created = await createUser({
        email: chosenEmail,
        password_hash,
        display_name: displayName,
      });
      if (ghUser?.avatar_url) {
        await pool.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [ghUser.avatar_url, created.id]);
      }
      user = await findUserByEmail(chosenEmail);
    }
    if (!user) {
      return res.status(500).json({ erreur: "Échec création/chargement utilisateur OAuth" });
    }

    const access = signAccessToken({ sub: user.id, email: user.email });
    const refresh = signRefreshToken({ sub: user.id, email: user.email });
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await storeRefreshToken({ userId: user.id, tokenHash: hashToken(refresh), expiresAt });

    const redir = new URL("/auth.html", returnTo);
    redir.searchParams.set("oauth", "github");
    redir.searchParams.set("accessToken", access);
    redir.searchParams.set("refreshToken", refresh);
    return res.redirect(redir.toString());
  } catch (err: any) {
    console.error("OAuth GitHub error:", err?.message || err);
    return res.status(500).json({ erreur: "Erreur OAuth GitHub" });
  }
});

router.post("/register", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erreur: "Données invalides", details: parsed.error.flatten() });
  }

  const { email, password, displayName } = parsed.data;

  const existing = await findUserByEmail(email);
  if (existing) return res.status(409).json({ erreur: "Email déjà utilisé" });

  const password_hash = await bcrypt.hash(password, 12);
  const user = await createUser({ email, password_hash, display_name: displayName });

  const access = signAccessToken({ sub: user.id, email: user.email });
  const refresh = signRefreshToken({ sub: user.id, email: user.email });

  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await storeRefreshToken({ userId: user.id, tokenHash: hashToken(refresh), expiresAt });

  return res.json({ user, accessToken: access, refreshToken: refresh });
});

router.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erreur: "Données invalides" });

  const { email, password } = parsed.data;

  const user = await findUserByEmail(email);
  if (!user) return res.status(401).json({ erreur: "Identifiants invalides" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ erreur: "Identifiants invalides" });

  const access = signAccessToken({ sub: user.id, email: user.email });
  const refresh = signRefreshToken({ sub: user.id, email: user.email });

  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await storeRefreshToken({ userId: user.id, tokenHash: hashToken(refresh), expiresAt });

  // safe user (sans password)
  const r = await pool.query(
    `SELECT id, email, display_name, username, avatar_url, cover_url, bio, website, location, gender, birth_date::text AS birth_date, created_at
     FROM users WHERE id = $1 LIMIT 1`,
    [user.id]
  );

  return res.json({ user: r.rows[0], accessToken: access, refreshToken: refresh });
});

router.post("/refresh", async (req, res) => {
  const token = String(req.body?.refreshToken || "");
  if (!token) return res.status(400).json({ erreur: "refreshToken manquant" });

  try {
    const payload = verifyRefreshToken(token);
    const tokenHash = hashToken(token);

    const row = await findRefreshToken({ userId: payload.sub, tokenHash });
    if (!row) return res.status(401).json({ erreur: "Refresh token invalide" });

    const access = signAccessToken({ sub: payload.sub, email: payload.email });
    return res.json({ accessToken: access });
  } catch {
    return res.status(401).json({ erreur: "Refresh token invalide ou expiré" });
  }
});

router.post("/logout", async (req, res) => {
  const token = String(req.body?.refreshToken || "");
  if (!token) return res.status(200).json({ ok: true });

  try {
    const payload = verifyRefreshToken(token);
    await deleteRefreshTokensForUser(payload.sub);
  } catch {
    // ignore
  }

  return res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const r = await pool.query(
    `SELECT 
      id,
      email,
      display_name,
      username,
      avatar_url,
      cover_url,
      bio,
      website,
      location,
      gender,
      birth_date::text AS birth_date,
      role,
      created_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [req.user!.id]
  );
  const user = r.rows[0];
  if (!user) return res.status(404).json({ erreur: "Utilisateur introuvable" });
  return res.json({ user });
});

router.patch("/me", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = UpdateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erreur: "Données invalides", details: parsed.error.flatten() });
  }

  // "" -> null (sur certains champs)
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (typeof v === "undefined") continue;

    if (v === "") {
      if (["website", "avatar_url", "cover_url", "birth_date", "gender"].includes(k)) clean[k] = null;
      else clean[k] = "";
      continue;
    }
    clean[k] = v;
  }

  const fields: string[] = [];
  const values: any[] = [];
  let i = 1;

  for (const [k, v] of Object.entries(clean)) {
    fields.push(`${k} = $${i++}`);
    values.push(v);
  }

  if (fields.length === 0) {
    const r0 = await pool.query(
      `SELECT id, email, display_name, username, avatar_url, cover_url, bio, website, location, gender, birth_date::text AS birth_date, created_at
       FROM users WHERE id = $1 LIMIT 1`,
      [req.user!.id]
    );
    return res.json({ user: r0.rows[0] });
  }

  values.push(req.user!.id);

  const r = await pool.query(
    `UPDATE users
     SET ${fields.join(", ")}
     WHERE id = $${i}
     RETURNING id, email, display_name, username, avatar_url, cover_url, bio, website, location, gender, birth_date::text AS birth_date, created_at`,
    values
  );

  return res.json({ user: r.rows[0] });
});

/**
 * Upload avatar/cover (pour ton profile.js)
 * POST /auth/upload/avatar  (multipart form-data, champ "file")
 * POST /auth/upload/cover
 * -> { url: "/uploads/xxxx.jpg" }
 */
router.post("/upload/:kind", requireAuth, async (req: AuthedRequest, res) => {
  const kind = String(req.params.kind || "");
  if (!["avatar", "cover"].includes(kind)) {
    return res.status(400).json({ erreur: "kind doit être avatar|cover" });
  }

  try {
    const { file } = await parseMultipart(req);
    if (!file) return res.status(400).json({ erreur: "Fichier manquant (field 'file')" });

    const ext = extFromMime(file.mime);
    if (!ext) return res.status(400).json({ erreur: "Format non supporté (png/jpg/webp)" });

    // max 3MB
    const max = 3 * 1024 * 1024;
    if (file.buffer.length > max) return res.status(400).json({ erreur: "Fichier trop lourd (max 3MB)" });

    const dir = ensureUploadsDir();
    const filename = `${kind}_${req.user!.id}_${randomUUID()}${ext}`;
    const abs = path.join(dir, filename);
    fs.writeFileSync(abs, file.buffer);

    const url = `/uploads/${filename}`;

    // on met à jour en DB
    const col = kind === "avatar" ? "avatar_url" : "cover_url";
    const r = await pool.query(
      `UPDATE users SET ${col} = $1 WHERE id = $2
       RETURNING id, email, display_name, username, avatar_url, cover_url, bio, website, location, gender, birth_date, created_at`,
      [url, req.user!.id]
    );

    return res.json({ url, user: r.rows[0] });
  } catch (e: any) {
    console.error("Upload error:", e?.message);
    return res.status(500).json({ erreur: "Upload échoué" });
  }
});

export default router;
