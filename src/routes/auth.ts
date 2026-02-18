import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { findUserByEmail, createUser, findUserById } from "../db/users";
import { storeRefreshToken, findRefreshToken, deleteRefreshTokensForUser } from "../db/refreshTokens";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../auth/jwt";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { pool } from "../connections";


const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(30),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// util: hash refresh token (on ne stocke jamais le token brut en DB)
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// health check for the auth router
router.get("/ping", (_req, res) => res.json({ ok: true }));

router.post("/register", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erreur: "Données invalides", details: parsed.error.flatten() });

  const { email, password, displayName } = parsed.data;
  const existing = await findUserByEmail(email);
  if (existing) return res.status(409).json({ erreur: "Email déjà utilisé" });

  const password_hash = await bcrypt.hash(password, 12);
  const user = await createUser({ email, password_hash, display_name: displayName });

  const access = signAccessToken({ sub: user.id, email: user.email });
  const refresh = signRefreshToken({ sub: user.id, email: user.email });

  // refresh TTL: 7 jours par défaut
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await storeRefreshToken({ userId: user.id, tokenHash: hashToken(refresh), expiresAt });

  res.json({ user, accessToken: access, refreshToken: refresh });
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

  const safeUser = await findUserById(user.id);
  res.json({ user: safeUser, accessToken: access, refreshToken: refresh });
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
    res.json({ accessToken: access });
  } catch {
    return res.status(401).json({ erreur: "Refresh token invalide ou expiré" });
  }
});

router.post("/logout", async (req, res) => {
  const token = String(req.body?.refreshToken || "");
  if (!token) return res.status(200).json({ ok: true }); // logout "idempotent"

  try {
    const payload = verifyRefreshToken(token);
    await deleteRefreshTokensForUser(payload.sub); // simple: on invalide tout
  } catch {
    // ignore
  }

  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await findUserById(req.user!.id);
  if (!user) return res.status(404).json({ erreur: "Utilisateur introuvable" });
  res.json({ user });
});

const UpdateMeSchema = z.object({
  displayName: z.string().min(2).max(30).optional(),
  bio: z.string().max(160).optional(),
  avatarUrl: z.string().url().optional(),
  website: z.string().url().optional(),
});

router.patch("/me", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = UpdateMeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erreur: "Données invalides" });

  const { displayName, bio, avatarUrl, website } = parsed.data;

  // update users
  const fields: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (displayName !== undefined) { fields.push(`display_name = $${i++}`); values.push(displayName); }
  if (bio !== undefined) { fields.push(`bio = $${i++}`); values.push(bio); }
  if (avatarUrl !== undefined) { fields.push(`avatar_url = $${i++}`); values.push(avatarUrl); }
  if (website !== undefined) { fields.push(`website = $${i++}`); values.push(website); }

  if (fields.length === 0) return res.json({ ok: true });

  values.push(req.user!.id);

  const r = await pool.query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${i}
     RETURNING id, email, display_name, avatar_url, bio, website, created_at`,
    values
  );

  res.json({ user: r.rows[0] });
});

export default router;
