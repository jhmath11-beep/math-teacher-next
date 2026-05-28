import { cookies } from "next/headers";
import crypto from "node:crypto";

const cookieName = "math_admin_session";
const sessions = new Set<string>();

export function isAdminSession() {
  const token = cookies().get(cookieName)?.value;
  return Boolean(token && sessions.has(token));
}

export function createAdminSession() {
  const token = crypto.randomUUID();
  sessions.add(token);
  cookies().set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export function clearAdminSession() {
  const token = cookies().get(cookieName)?.value;
  if (token) sessions.delete(token);
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
