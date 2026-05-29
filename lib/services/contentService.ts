import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { BootstrapData, CreateSubunitInput } from "@/types/database";

const PDF_BUCKET = "math-textbook-pdfs";

function throwSupabaseError(error: { message?: string; details?: string; hint?: string; code?: string }) {
  const parts = [error.message, error.details, error.hint, error.code ? `code: ${error.code}` : ""].filter(Boolean);
  throw new Error(parts.join(" / ") || "Supabase 요청에 실패했습니다.");
}

export async function getBootstrapData(): Promise<BootstrapData> {
  const supabase = createSupabaseAdmin();

  const [grades, publishers, units, subunits, texts, generated] = await Promise.all([
    supabase.from("math_grades").select("*").order("order_index").order("name"),
    supabase.from("math_publishers").select("*").order("order_index").order("name"),
    supabase.from("math_units").select("*").order("order_index").order("title"),
    supabase.from("math_subunits").select("*").order("order_index").order("title"),
    supabase.from("math_subunit_texts").select("*"),
    supabase.from("math_generated_contents").select("*")
  ]);

  for (const result of [grades, publishers, units, subunits, texts, generated]) {
    if (result.error) throwSupabaseError(result.error);
  }

  return {
    grades: grades.data ?? [],
    publishers: publishers.data ?? [],
    units: (units.data ?? []).map((unit) => ({
      id: unit.id,
      gradeId: unit.grade_id,
      publisherId: unit.publisher_id,
      title: unit.title,
      order: unit.order_index
    })),
    subunits: (subunits.data ?? []).map((subunit) => ({
      id: subunit.id,
      unitId: subunit.unit_id,
      title: subunit.title,
      achievementStandard: subunit.achievement_standard || "",
      keywords: subunit.keywords || [],
      status: subunit.status,
      order: subunit.order_index
    })),
    pdfTexts: Object.fromEntries((texts.data ?? []).map((item) => [
      item.subunit_id,
      {
        fileName: item.pdf_file_name || "",
        filePath: item.pdf_file_path || "",
        text: item.extracted_text,
        updatedAt: item.updated_at
      }
    ])),
    generated: Object.fromEntries((generated.data ?? []).map((item) => [
      item.subunit_id,
      {
        content: item.content,
        source: item.source,
        model: item.model,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }
    ]))
  };
}

export async function createSubunit(input: CreateSubunitInput) {
  const supabase = createSupabaseAdmin();

  const { data: grade, error: gradeError } = await supabase
    .from("math_grades")
    .upsert({ name: input.gradeName.trim() }, { onConflict: "name" })
    .select()
    .single();
  if (gradeError) throw gradeError;

  const { data: publisher, error: publisherError } = await supabase
    .from("math_publishers")
    .upsert({ name: input.publisherName.trim() }, { onConflict: "name" })
    .select()
    .single();
  if (publisherError) throw publisherError;

  const { data: unit, error: unitError } = await supabase
    .from("math_units")
    .upsert(
      {
        grade_id: grade.id,
        publisher_id: publisher.id,
        title: input.unitTitle.trim()
      },
      { onConflict: "grade_id,publisher_id,title" }
    )
    .select()
    .single();
  if (unitError) throw unitError;

  const { data: subunit, error: subunitError } = await supabase
    .from("math_subunits")
    .upsert(
      {
        unit_id: unit.id,
        title: input.subunitTitle.trim()
      },
      { onConflict: "unit_id,title" }
    )
    .select()
    .single();
  if (subunitError) throw subunitError;

  return { grade, publisher, unit, subunit };
}

export async function saveSubunitText(input: {
  subunitId: string;
  fileName?: string;
  extractedText: string;
  pdfBase64?: string;
  pdfFilePath?: string;
}) {
  const supabase = createSupabaseAdmin();
  let pdfFilePath = input.pdfFilePath || "";

  if (input.pdfBase64) {
    const objectPath = `subunits/${input.subunitId}/${Date.now()}-original.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(PDF_BUCKET)
      .upload(objectPath, Buffer.from(input.pdfBase64, "base64"), {
        contentType: "application/pdf",
        upsert: true
      });
    if (uploadError) throw uploadError;
    pdfFilePath = objectPath;
  }

  const { data, error } = await supabase
    .from("math_subunit_texts")
    .upsert(
      {
        subunit_id: input.subunitId,
        pdf_file_path: pdfFilePath || undefined,
        pdf_file_name: input.fileName || "",
        extracted_text: input.extractedText,
        extraction_status: "completed",
        updated_at: new Date().toISOString()
      },
      { onConflict: "subunit_id" }
    )
    .select()
    .single();
  if (error) throw error;

  await supabase.from("math_generated_contents").delete().eq("subunit_id", input.subunitId);
  return data;
}

export async function saveSubunitStandard(input: {
  subunitId: string;
  achievementStandard: string;
}) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("math_subunits")
    .update({
      achievement_standard: input.achievementStandard || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", input.subunitId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGeneratedContent(subunitId: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("math_generated_contents")
    .delete()
    .eq("subunit_id", subunitId);
  if (error) throw error;
  return { ok: true };
}

export async function saveEditedGeneratedContent(input: {
  subunitId: string;
  content: unknown;
}) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("math_generated_contents")
    .upsert(
      {
        subunit_id: input.subunitId,
        content: input.content,
        source: "edited",
        model: "teacher-edited",
        updated_at: new Date().toISOString()
      },
      { onConflict: "subunit_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
