import { buildFocusedSectionPrompt, buildLeveledQuestionPrompt, buildMathTeacherPrompt, buildReferenceAnalysisPrompt, EVALUATION_EXPERT_GUIDE } from "@/lib/ai/prompt";
import { extractStandardCode, formatLevelSpectrum, formatTargetLevel, getAchievementLevels } from "@/lib/data/achievementLevels";
import type { GeneratedContent } from "@/types/content";

export type TargetLevel = "A" | "B" | "C" | "D" | "E";

function asArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return value.split(/\n+/).map((item) => item.replace(/^[-\d.\s]+/, "").trim()).filter(Boolean);
  return [];
}

function pickValue(data: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    if (data[name] !== undefined) return data[name];
  }

  const entry = Object.entries(data).find(([key]) =>
    names.some((name) => key.replace(/\s/g, "").includes(name.replace(/\s/g, "")))
  );
  return entry?.[1];
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseJsonLikeText(text: string) {
  const source = text.trim();
  try {
    return JSON.parse(source);
  } catch {
    const jsonMatch = source.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI 응답을 JSON으로 해석하지 못했습니다.");

    const jsonText = jsonMatch[0];
    try {
      return JSON.parse(jsonText);
    } catch {
      const repaired = jsonText.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
      return JSON.parse(repaired);
    }
  }
}

// 모델이 줄바꿈을 \\n(리터럴 백슬래시-n)으로 잘못 이스케이프하는 경우를 복구한다.
// $...$ 수학 구간은 LaTeX 명령어(\\nu 등)를 깨지 않도록 그대로 보존한다.
function fixEssayMarkdown(md: string): string {
  if (!md) return "";
  return md
    .split(/(\$[^$]*\$)/)
    .map((segment, index) => {
      if (index % 2 === 1) return segment; // $...$ 수학 구간은 손대지 않음
      return segment.replace(/\\n/g, "\n").replace(/\\t/g, "  ");
    })
    .join("");
}

export function normalizeGeneratedContent(raw: unknown): GeneratedContent {
  const data = asRecord(raw);
  const tips = asRecord(pickValue(data, ["teacherTips", "교사용 활용 팁", "교사용활용팁", "활용 팁"]));

  return {
    achievementStandards: asArray(pickValue(data, ["achievementStandards", "과목별 단원별 성취기준", "성취기준"])).map((item) => {
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
    summary: asArray(pickValue(data, ["summary", "핵심 개념 요약", "핵심개념요약", "개념 요약", "개념요약"])).map(String),
    checkQuizzes: asArray(pickValue(data, ["checkQuizzes", "확인 퀴즈", "확인퀴즈"])).map((item) => {
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
    examQuestions: asArray(pickValue(data, ["examQuestions", "시험대비문항", "시험 대비 문항"])).map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : { question: String(item) };
      return {
        difficulty: String(row.difficulty || row["난이도"] || ""),
        question: String(row.question || row["문항"] || row["문제"] || ""),
        choices: asArray(row.choices || row["선택지"] || row["보기"]).map(String),
        answer: String(row.answer || row["정답"] || ""),
        solution: String(row.solution || row["풀이 과정"] || row["풀이"] || "")
      };
    }),
    essayQuestions: asArray(pickValue(data, ["essayQuestions", "논술형 예시 문항", "논술형예시문항", "논술형 문항"])).map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : { question: String(item) };
      return {
        title: String(row.title || row["제목"] || ""),
        scenario: String(row.scenario || row["상황"] || row["상황 맥락"] || ""),
        passages: asArray(row.passages || row["제시문"]).map((passage) => {
          const passageRow = passage && typeof passage === "object" ? passage as Record<string, unknown> : {};
          return {
            label: String(passageRow.label || passageRow["기호"] || ""),
            text: String(passageRow.text || passageRow["내용"] || passage)
          };
        }),
        subQuestions: asArray(row.subQuestions || row["소문항"]).map((subQuestion) => {
          const subRow = subQuestion && typeof subQuestion === "object" ? subQuestion as Record<string, unknown> : {};
          return {
            number: String(subRow.number || subRow["번호"] || ""),
            question: String(subRow.question || subRow["문항"] || subRow["문제"] || subQuestion),
            answer: String(subRow.answer || subRow["정답"] || subRow["모범 답안"] || "")
          };
        }),
        question: String(row.question || row["문항"] || row["문제"] || ""),
        modelAnswer: String(row.modelAnswer || row["모범 답안"] || row["예시 답안"] || "")
      };
    }),
    rubric: pickValue(data, ["rubric", "논술형 채점 루브릭", "채점 루브릭", "루브릭"]) || {},
    essayMarkdown: fixEssayMarkdown(String(pickValue(data, ["essayMarkdown", "논술형마크다운", "논술형 마크다운"]) || "")),
    gameActivities: asArray(pickValue(data, ["gameActivities", "게임 활동", "게임활동", "게임 활동 제작용 프롬프트 제작"])).map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : { title: String(item) };
      return {
        title: String(row.title || row["활동명"] || row["제목"] || "게임 활동"),
        duration: String(row.duration || row["시간"] || "30~45분"),
        target: String(row.target || row["활동 목표"] || row["목표"] || ""),
        materials: String(row.materials || row["준비물"] || ""),
        procedure: Array.isArray(row.procedure || row["진행 방법"])
          ? (row.procedure || row["진행 방법"]) as string[]
          : String(row.procedure || row["진행 방법"] || ""),
        variation: Array.isArray(row.variation || row["변형 방법"])
          ? (row.variation || row["변형 방법"]) as string[]
          : String(row.variation || row["변형 방법"] || ""),
        teacherGuide: String(row.teacherGuide || row["교사용 진행 안내"] || row["교사용 안내"] || ""),
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

export function hasGeneratedContent(content: GeneratedContent) {
  return Boolean(
    content.achievementStandards?.length ||
    content.summary?.length ||
    content.checkQuizzes?.length ||
    content.examQuestions?.length ||
    content.essayQuestions?.length ||
    content.essayMarkdown ||
    content.gameActivities?.length ||
    content.teacherTips?.intro ||
    content.teacherTips?.development ||
    content.teacherTips?.wrapUp ||
    (content.rubric && typeof content.rubric === "object" && Object.keys(content.rubric).length)
  );
}

export async function generateMathContent(input: {
  subunitTitle: string;
  extractedText: string;
  achievementStandard?: string;
}) {
  const achievementLevelSpectrum = formatLevelSpectrum(extractStandardCode(input.achievementStandard));
  const { parsed, model } = await callOpenAI(buildMathTeacherPrompt({ ...input, achievementLevelSpectrum }));
  return {
    source: "ai",
    model,
    content: normalizeGeneratedContent(parsed)
  };
}

async function requestOpenAIText(input: {
  prompt: string;
  useWebSearch: boolean;
  jsonMode: boolean;
  imageDataUrl?: string;
  instructions?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  // 이미지가 있으면 멀티모달(input_text + input_image) 메시지 배열로, 없으면 단순 문자열로 보낸다.
  const requestInput = input.imageDataUrl
    ? [
        {
          role: "user",
          content: [
            { type: "input_text", text: input.prompt },
            { type: "input_image", image_url: input.imageDataUrl }
          ]
        }
      ]
    : input.prompt;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      instructions: input.instructions,
      tools: input.useWebSearch
        ? [{ type: "web_search" }]
        : undefined,
      tool_choice: input.useWebSearch ? "auto" : undefined,
      input: requestInput,
      text: input.jsonMode ? { format: { type: "json_object" } } : undefined
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

  return { text, model };
}

async function callOpenAI(prompt: string, instructions: string = EVALUATION_EXPERT_GUIDE) {
  const enableWebSearch = process.env.OPENAI_ENABLE_WEB_SEARCH === "true";

  if (enableWebSearch) {
    const search = await requestOpenAIText({
      useWebSearch: true,
      jsonMode: false,
      instructions,
      prompt: [
        prompt,
        "",
        "위 요청을 해결하기 위해 웹 검색으로 참고할 만한 중학교 수학 문항 유형, 활동 아이디어, 평가 발문 패턴을 요약하세요.",
        "최종 문항을 만들지 말고 참고 아이디어만 한국어로 정리하세요.",
        "저작권이 있는 문항을 그대로 옮기지 말고 구조와 아이디어만 요약하세요."
      ].join("\n")
    });

    const final = await requestOpenAIText({
      useWebSearch: false,
      jsonMode: true,
      instructions,
      prompt: [
        prompt,
        "",
        "[웹 검색 참고 요약]",
        search.text.slice(0, 8000),
        "",
        "위 검색 요약은 참고만 하세요. 최종 결과는 제공된 교과서 텍스트와 성취기준 범위 안에서 새로 작성하세요.",
        "반드시 올바른 JSON 객체 하나만 출력하세요."
      ].join("\n")
    });
    return { parsed: parseJsonLikeText(final.text), model: final.model };
  }

  const final = await requestOpenAIText({
    useWebSearch: false,
    jsonMode: true,
    instructions,
    prompt
  });
  return { parsed: parseJsonLikeText(final.text), model: final.model };
}

export async function generateFocusedSection(input: {
  subunitTitle: string;
  extractedText: string;
  achievementStandard?: string;
  section: "exam" | "essay" | "game";
}) {
  const achievementLevelSpectrum = formatLevelSpectrum(extractStandardCode(input.achievementStandard));
  const { parsed, model } = await callOpenAI(buildFocusedSectionPrompt({ ...input, achievementLevelSpectrum }));
  const normalized = normalizeGeneratedContent(parsed);
  return {
    source: "ai",
    model,
    content: normalized
  };
}

export async function generateLeveledQuestions(input: {
  subunitTitle: string;
  extractedText?: string;
  achievementStandard?: string;
  targetLevel: TargetLevel;
  requestNote?: string;
}) {
  const code = extractStandardCode(input.achievementStandard);
  const levels = getAchievementLevels(code);
  const targetLevelText = formatTargetLevel(code, input.targetLevel)
    || `[목표 성취수준: ${input.targetLevel}] 소단원명과 성취기준에 근거하여 해당 수준에 맞게 출제하세요.`;

  const { parsed, model } = await callOpenAI(
    buildLeveledQuestionPrompt({
      subunitTitle: input.subunitTitle,
      extractedText: input.extractedText,
      achievementStandard: input.achievementStandard,
      achievementLevelSpectrum: formatLevelSpectrum(code),
      targetLevel: input.targetLevel,
      targetLevelText,
      requestNote: input.requestNote
    })
  );

  return {
    source: "ai-leveled",
    model,
    targetLevel: input.targetLevel,
    hasLevelData: Boolean(levels),
    content: normalizeGeneratedContent(parsed)
  };
}

export async function generateFromReference(input: {
  referenceText?: string;
  imageDataUrl?: string;
  requestNote?: string;
}) {
  const { text, model } = await requestOpenAIText({
    useWebSearch: false,
    jsonMode: true,
    instructions: EVALUATION_EXPERT_GUIDE,
    prompt: buildReferenceAnalysisPrompt({
      referenceText: input.referenceText,
      hasImage: Boolean(input.imageDataUrl),
      requestNote: input.requestNote
    }),
    imageDataUrl: input.imageDataUrl
  });

  return {
    source: "ai-reference",
    model,
    content: normalizeGeneratedContent(parseJsonLikeText(text))
  };
}
