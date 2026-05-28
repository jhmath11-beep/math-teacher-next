import { NextResponse } from "next/server";
import { saveSubunitStandard } from "@/lib/services/contentService";
import { isAdminSession } from "@/lib/auth/adminAuth";

export async function POST(request: Request) {
  try {
    if (!isAdminSession()) {
      return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
    }
    const body = await request.json();
    if (!body.subunitId) {
      return NextResponse.json({ error: "소단원 ID가 필요합니다." }, { status: 400 });
    }

    return NextResponse.json(await saveSubunitStandard(body));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
