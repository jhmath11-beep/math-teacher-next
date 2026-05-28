import { NextResponse } from "next/server";
import { createSubunit } from "@/lib/services/contentService";
import { isAdminSession } from "@/lib/auth/adminAuth";

export async function POST(request: Request) {
  try {
    if (!isAdminSession()) {
      return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
    }
    const body = await request.json();
    if (!body.gradeName || !body.publisherName || !body.unitTitle || !body.subunitTitle) {
      return NextResponse.json(
        { error: "학년, 출판사, 대단원, 소단원을 모두 입력해 주세요." },
        { status: 400 }
      );
    }

    return NextResponse.json(await createSubunit(body));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
