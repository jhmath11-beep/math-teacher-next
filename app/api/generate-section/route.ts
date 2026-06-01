import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { generateFocusedSection, normalizeGeneratedContent } from "@/lib/ai/generateContent";
import type { GeneratedContent } from "@/types/content";

type Section = "exam" | "essay" | "game";

function isSection(value: unknown): value is Section {
  return value === "exam" || value === "essay" || value === "game";
}

function mergeSection(base: GeneratedContent, update: GeneratedContent, section: Section): GeneratedContent {
  if (section === "exam") {
    return { ...base, examQuestions: update.examQuestions };
  }

  if (section === "essay") {
    return { ...base, essayQuestions: update.essayQuestions, rubric: update.rubric };
  }

  return { ...base, gameActivities: update.gameActivities };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.subunitId || !isSection(body.section)) {
      return NextResponse.json(
        { error: "소단원 ID와 생성할 섹션이 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

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

    const { data: saved } = await supabase
      .from("math_generated_contents")
      .select("*")
      .eq("subunit_id", body.subunitId)
      .maybeSingle();

    const currentContent = normalizeGeneratedContent(saved?.content || {});
    const result = await generateFocusedSection({
      subunitTitle: subunit.title,
      achievementStandard: subunit.achievement_standard || "",
      extractedText: textRow.extracted_text,
      section: body.section,
      currentContent
    });

    const mergedContent = mergeSection(currentContent, result.content, body.section);

    const { error: saveError } = await supabase
      .from("math_generated_contents")
      .upsert(
        {
          subunit_id: body.subunitId,
          content: mergedContent,
          source: "ai-section",
          model: result.model,
          updated_at: new Date().toISOString()
        },
        { onConflict: "subunit_id" }
      );
    if (saveError) throw saveError;

    return NextResponse.json({
      source: "ai-section",
      model: result.model,
      section: body.section,
      content: mergedContent
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
