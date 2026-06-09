import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { generateMathContent, hasGeneratedContent, normalizeGeneratedContent } from "@/lib/ai/generateContent";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.subunitId) {
      return NextResponse.json({ error: "소단원 ID가 필요합니다." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // 목표 성취수준(A~E). "미지정"/빈값이면 수준 무관(혼합 난이도).
    const levels = ["A", "B", "C", "D", "E"];
    const requestedLevel = typeof body.level === "string" && levels.includes(body.level) ? body.level : "";

    const { data: saved } = await supabase
      .from("math_generated_contents")
      .select("*")
      .eq("subunit_id", body.subunitId)
      .maybeSingle();

    if (saved) {
      const cachedContent = normalizeGeneratedContent(saved.content);
      // 캐시는 같은 목표 수준일 때만 재사용한다(수준이 다르면 새 난이도로 재생성).
      if (!body.force && (cachedContent.targetLevel || "") === requestedLevel && hasGeneratedContent(cachedContent)) {
        return NextResponse.json({
          source: saved.source,
          content: cachedContent,
          model: saved.model,
          cached: true
        });
      }

      await supabase
        .from("math_generated_contents")
        .delete()
        .eq("subunit_id", body.subunitId);
    }

    const { data: textRow, error: textError } = await supabase
      .from("math_subunit_texts")
      .select("*")
      .eq("subunit_id", body.subunitId)
      .maybeSingle();
    if (textError) throw textError;
    if (!textRow?.extracted_text) {
      return NextResponse.json(
        { error: "소단원 DB에 저장된 추출 텍스트가 없습니다." },
        { status: 400 }
      );
    }

    const { data: subunit, error: subunitError } = await supabase
      .from("math_subunits")
      .select("id,title,achievement_standard")
      .eq("id", body.subunitId)
      .single();
    if (subunitError) throw subunitError;

    const result = await generateMathContent({
      subunitTitle: subunit.title,
      achievementStandard: subunit.achievement_standard || "",
      extractedText: textRow.extracted_text,
      targetLevel: requestedLevel as "A" | "B" | "C" | "D" | "E" | ""
    });

    const { error: saveError } = await supabase
      .from("math_generated_contents")
      .upsert(
        {
          subunit_id: body.subunitId,
          content: result.content,
          source: result.source,
          model: result.model,
          updated_at: new Date().toISOString()
        },
        { onConflict: "subunit_id" }
      );
    if (saveError) throw saveError;

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
