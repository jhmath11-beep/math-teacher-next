import { cookies } from "next/headers";
import crypto from "node:crypto";

const cookieName = "math_admin_session";

function sessionSecret() {
  return process.env.APP_ADMIN_PASSWORD || "admin1234";
}

function signToken(token: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(token).digest("hex");
}

function createSignedSessionValue() {
  const token = crypto.randomUUID();
  return `${token}.${signToken(token)}`;
}

function isValidSessionValue(value: string) {
  const [token, signature] = value.split(".");
  if (!token || !signature) return false;
  const expected = signToken(token);
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function isAdminSession() {
  const token = cookies().get(cookieName)?.value;
  return Boolean(token && isValidSessionValue(token));
}

export function createAdminSession() {
  cookies().set(cookieName, createSignedSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export function clearAdminSession() {
  cookies().set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export function verifyAdminPassword(password: string) {
  return password === (process.env.APP_ADMIN_PASSWORD || "admin1234");
}
