import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { generateMathContent } from "@/lib/ai/generateContent";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.subunitId) {
      return NextResponse.json({ error: "소단원 ID가 필요합니다." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data: saved } = await supabase
      .from("math_generated_contents")
      .select("*")
      .eq("subunit_id", body.subunitId)
      .maybeSingle();

    if (saved) {
      return NextResponse.json({
        source: saved.source,
        content: saved.content,
        model: saved.model,
        cached: true
      });
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
      extractedText: textRow.extracted_text
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
