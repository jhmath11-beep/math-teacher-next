import { NextResponse } from "next/server";
import { createAdminSession, verifyAdminPassword } from "@/lib/auth/adminAuth";

export async function POST(request: Request) {
  const body = await request.json();
  if (!verifyAdminPassword(body.password || "")) {
    return NextResponse.json(
      { error: "관리자 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  createAdminSession();
  return NextResponse.json({ ok: true });
}
