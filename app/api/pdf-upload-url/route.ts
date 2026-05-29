import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const PDF_BUCKET = "math-textbook-pdfs";

function safeObjectPath(subunitId: string) {
  return `subunits/${subunitId}/${Date.now()}-original.pdf`;
}

export async function POST(request: Request) {
  try {
    if (!isAdminSession()) {
      return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    if (!body.subunitId) {
      return NextResponse.json({ error: "소단원 ID가 필요합니다." }, { status: 400 });
    }

    const objectPath = safeObjectPath(body.subunitId);
    const { data, error } = await createSupabaseAdmin()
      .storage
      .from(PDF_BUCKET)
      .createSignedUploadUrl(objectPath);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      bucket: PDF_BUCKET,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF 업로드 주소 생성 실패" },
      { status: 500 }
    );
  }
}
