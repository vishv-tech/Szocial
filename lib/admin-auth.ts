import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import { cookies } from "next/headers";

const ADMIN_COOKIE_NAME = "szocial_admin_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

type AdminSessionPayload = {
  scope: "admin";
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function getAdminConfig() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";

  if (!email || !password || secret.length < 32) return null;
  return { email, password, secret };
}

function safeEqual(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function createSessionToken(secret: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    scope: "admin",
    issuedAt,
    expiresAt: issuedAt + SESSION_DURATION_SECONDS,
    nonce: randomBytes(16).toString("base64url")
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

function verifySessionToken(token: string, secret: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  const expectedSignature = signPayload(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as AdminSessionPayload;
    const now = Math.floor(Date.now() / 1000);
    return (
      payload.scope === "admin" &&
      Number.isFinite(payload.issuedAt) &&
      Number.isFinite(payload.expiresAt) &&
      payload.issuedAt <= now &&
      payload.expiresAt > now
    );
  } catch {
    return false;
  }
}

export function isAdminAuthConfigured() {
  return Boolean(getAdminConfig());
}

export function validateAdminCredentials(email: string, password: string) {
  const config = getAdminConfig();
  if (!config) return false;
  return (
    safeEqual(email.trim().toLowerCase(), config.email) &&
    safeEqual(password, config.password)
  );
}

export async function createAdminSession() {
  const config = getAdminConfig();
  if (!config) throw new Error("Admin authentication is not configured.");

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, createSessionToken(config.secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS
  });
}

export async function getAdminSession() {
  const config = getAdminConfig();
  if (!config) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return token ? verifySessionToken(token, config.secret) : false;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
