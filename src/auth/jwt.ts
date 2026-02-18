import jwt, { SignOptions } from "jsonwebtoken";

export type JwtPayload = { sub: string; email: string };

const accessSecret = process.env.JWT_ACCESS_SECRET || "your-access-secret";
const refreshSecret = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
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
