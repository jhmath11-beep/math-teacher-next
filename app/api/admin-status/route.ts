import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth/adminAuth";

export async function GET() {
  return NextResponse.json({ isAdmin: isAdminSession() });
}
