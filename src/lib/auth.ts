import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { getDb, mapUserRow } from "./db";
import type { PublicUser, UserRole } from "./types";

export const SESSION_COOKIE_NAME = "petronabz_session";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

interface SessionPayload {
  uid: number;
  role: UserRole;
  exp: number;
}

const globalForAuth = globalThis as unknown as { __petronabzSecret?: string };

function getSigningSecret(): string {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    return process.env.AUTH_SECRET;
  }
  if (globalForAuth.__petronabzSecret) {
    return globalForAuth.__petronabzSecret;
  }

  // On read-only serverless platforms (e.g. Vercel), derive stably from DB URL or env if AUTH_SECRET isn't set
  const dbSeed =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL;
  if (process.env.VERCEL || dbSeed) {
    const derived = crypto
      .createHash("sha256")
      .update(`petronabz-session:${dbSeed || "vercel"}`)
      .digest("hex");
    globalForAuth.__petronabzSecret = derived;
    return derived;
  }

  const secretPath = path.join(process.cwd(), "data", ".session-secret");
  try {
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, "utf8").trim();
      if (existing.length >= 32) {
        globalForAuth.__petronabzSecret = existing;
        return existing;
      }
    }
    const dir = path.dirname(secretPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const generated = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(secretPath, generated, "utf8");
    globalForAuth.__petronabzSecret = generated;
    return generated;
  } catch {
    const fallback = crypto.randomBytes(32).toString("hex");
    globalForAuth.__petronabzSecret = fallback;
    return fallback;
  }
}

function signData(dataB64: string): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(dataB64)
    .digest("base64url");
}

export function createSessionToken(userId: number, role: UserRole): string {
  const payload: SessionPayload = {
    uid: userId,
    role,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const dataB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = signData(dataB64);
  return `${dataB64}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [dataB64, sig] = token.split(".");
  if (!dataB64 || !sig) return null;
  const expectedSig = signData(dataB64);
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const decoded = JSON.parse(
      Buffer.from(dataB64, "base64url").toString("utf8")
    ) as SessionPayload;
    if (!decoded.uid || !decoded.exp || decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function isStaffRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "SALES";
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const db = await getDb();
  const row = await db.get<Record<string, unknown>>(
    "SELECT * FROM users WHERE id = ? AND is_active = 1",
    payload.uid
  );
  if (!row) return null;
  return mapUserRow(row);
}

export function buildSessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && Boolean(process.env.VERCEL),
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}
