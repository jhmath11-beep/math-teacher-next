import { NextResponse } from "next/server";
import { generateFromReference } from "@/lib/ai/generateContent";

// Vercel 서버리스 요청 본문 한도(~4.5MB)를 넘지 않도록 data URL 길이를 4MB로 제한한다.
// 클라이언트가 이미지를 사전 축소해 보내므로 실제로는 이보다 훨씬 작다.
const MAX_IMAGE_DATA_URL_LENGTH = 4_000_000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const referenceText = typeof body.referenceText === "string" ? body.referenceText.trim() : "";
    const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";

    if (!referenceText && !imageDataUrl) {
      return NextResponse.json(
        { error: "분석할 기존 문항(텍스트 또는 이미지)을 입력해 주세요." },
        { status: 400 }
      );
    }

    if (imageDataUrl) {
      if (!imageDataUrl.startsWith("data:image/")) {
        return NextResponse.json({ error: "이미지 형식이 올바르지 않습니다." }, { status: 400 });
      }
      if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
        return NextResponse.json(
          { error: "이미지가 너무 큽니다. 더 작은 이미지로 다시 시도해 주세요." },
          { status: 413 }
        );
      }
    }

    const result = await generateFromReference({
      referenceText: referenceText || undefined,
      imageDataUrl: imageDataUrl || undefined,
      requestNote: typeof body.note === "string" ? body.note : undefined
    });

    // 일회성 모드: 캐시에 저장하지 않는다.
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
