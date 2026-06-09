import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { generateLeveledQuestions, type TargetLevel } from "@/lib/ai/generateContent";

const LEVELS: TargetLevel[] = ["A", "B", "C", "D", "E"];

function isLevel(value: unknown): value is TargetLevel {
  return typeof value === "string" && (LEVELS as string[]).includes(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.subunitId) {
      return NextResponse.json({ error: "소단원 ID가 필요합니다." }, { status: 400 });
    }
    if (!isLevel(body.level)) {
      return NextResponse.json({ error: "목표 성취수준(A~E)이 필요합니다." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data: subunit, error: subunitError } = await supabase
      .from("math_subunits")
      .select("id,title,achievement_standard")
      .eq("id", body.subunitId)
      .single();
    if (subunitError) throw subunitError;

    // 교과서 텍스트는 있으면 참고용으로만 사용(없어도 성취수준 기반으로 생성 가능).
    const { data: textRow } = await supabase
      .from("math_subunit_texts")
      .select("extracted_text")
      .eq("subunit_id", body.subunitId)
      .maybeSingle();

    const result = await generateLeveledQuestions({
      subunitTitle: subunit.title,
      achievementStandard: subunit.achievement_standard || "",
      extractedText: textRow?.extracted_text || undefined,
      targetLevel: body.level,
      requestNote: typeof body.note === "string" ? body.note : undefined
    });

    // 일회성 모드: 캐시(math_generated_contents)에 저장하지 않는다.
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
