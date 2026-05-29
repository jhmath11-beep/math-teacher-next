import { buildMathTeacherPrompt } from "@/lib/ai/prompt";
import type { GeneratedContent } from "@/types/content";

function asArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return value.split(/\n+/).map((item) => item.replace(/^[-\d.\s]+/, "").trim()).filter(Boolean);
  return [];
}

export function normalizeGeneratedContent(raw: unknown): GeneratedContent {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const tips = (data.teacherTips || data["교사용 활용 팁"] || {}) as Record<string, unknown>;

  return {
    achievementStandards: asArray(data.achievementStandards || data["과목별 단원별 성취기준"]).map((item) => {
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        return {
          code: String(row.code || row["코드"] || ""),
          description: String(row.description || row["성취기준"] || row["내용"] || ""),
          relation: String(row.relation || row["관련성"] || "직접 연결")
        };
      }
      return { code: "", description: String(item), relation: "직접 연결" };
    }),
    summary: asArray(data.summary || data["핵심 개념 요약"]).map(String),
    checkQuizzes: asArray(data.checkQuizzes || data["확인 퀴즈"]).map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : { question: String(item) };
      return {
        difficulty: String(row.difficulty || row["난이도"] || ""),
        type: String(row.type || row["유형"] || ""),
        question: String(row.question || row["문항"] || row["문제"] || ""),
        choices: asArray(row.choices || row["선택지"]).map(String),
        answer: String(row.answer || row["정답"] || ""),
        explanation: String(row.explanation || row["해설"] || "")
      };
    }),
    examQuestions: asArray(data.examQuestions || data["시험대비문항"]).map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : { question: String(item) };
      return {
        question: String(row.question || row["문항"] || row["문제"] || ""),
        answer: String(row.answer || row["정답"] || ""),
        solution: String(row.solution || row["풀이 과정"] || row["풀이"] || "")
      };
    }),
    essayQuestions: asArray(data.essayQuestions || data["논술형 예시 문항"]).map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : { question: String(item) };
      return {
        question: String(row.question || row["문항"] || row["문제"] || ""),
        modelAnswer: String(row.modelAnswer || row["모범 답안"] || row["예시 답안"] || "")
      };
    }),
    rubric: data.rubric || data["논술형 채점 루브릭"] || {},
    gameActivities: asArray(data.gameActivities || data["게임 활동"] || data["게임 활동 제작용 프롬프트 제작"]).map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : { title: String(item) };
      return {
        title: String(row.title || row["활동명"] || row["제목"] || "게임 활동"),
        duration: String(row.duration || row["시간"] || "30~45분"),
        materials: String(row.materials || row["준비물"] || ""),
        procedure: String(row.procedure || row["진행 방법"] || ""),
        variation: String(row.variation || row["변형 방법"] || ""),
        aiPrompt: String(row.aiPrompt || row["AI 붙여넣기용 프롬프트"] || row["프롬프트"] || "")
      };
    }),
    teacherTips: {
      intro: String(tips.intro || tips["도입"] || ""),
      development: String(tips.development || tips["전개"] || ""),
      wrapUp: String(tips.wrapUp || tips["정리"] || "")
    }
  };
}

export async function generateMathContent(input: {
  subunitTitle: string;
  extractedText: string;
  achievementStandard?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: buildMathTeacherPrompt(input),
      text: { format: { type: "json_object" } }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI API error: ${response.status} ${detail}`);
  }

  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((item: { content?: Array<{ type: string; text?: string }> }) => item.content || [])
    .find((item: { type: string }) => item.type === "output_text")?.text;

  if (!text) throw new Error("AI response text was empty.");

  return {
    source: "ai",
    model,
    content: normalizeGeneratedContent(JSON.parse(text))
  };
}
