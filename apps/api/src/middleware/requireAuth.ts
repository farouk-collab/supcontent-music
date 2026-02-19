import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../auth/jwt";

export type AuthedRequest = Request & { user?: { id: string; email: string } };

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) return res.status(401).json({ erreur: "Token manquant" });

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ erreur: "Token invalide ou expiré" });
  }
}
