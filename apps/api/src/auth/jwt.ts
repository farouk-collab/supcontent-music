import jwt from "jsonwebtoken";

export type JwtPayload = { sub: string; email: string };

function requiredSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET") {
  const value = String(process.env[name] || "").trim();
  if (value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} doit contenir au moins 32 caractères`);
  }
  return `supcontent-${name.toLowerCase()}-development-secret`;
}

const accessSecret = requiredSecret("JWT_ACCESS_SECRET");
const refreshSecret = requiredSecret("JWT_REFRESH_SECRET");
const accessTtl: string | number = process.env.ACCESS_TOKEN_TTL || "15m";
const refreshTtl: string | number = process.env.REFRESH_TOKEN_TTL || "7d";

export function signAccessToken(payload: JwtPayload): string {
  // expiresIn accepts number or string; let inference handle it
  return (jwt as any).sign(payload, accessSecret, { expiresIn: accessTtl });
}

export function signRefreshToken(payload: JwtPayload): string {
  return (jwt as any).sign(payload, refreshSecret, { expiresIn: refreshTtl });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, refreshSecret) as JwtPayload;
}
