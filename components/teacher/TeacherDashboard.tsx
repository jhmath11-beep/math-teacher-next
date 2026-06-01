"use client";

import { useEffect, useMemo, useState } from "react";
import type { BootstrapData } from "@/types/database";
import type { GeneratedContent } from "@/types/content";

type Notice = {
  tone: "normal" | "error";
  message: string;
};

type RenderedResult = {
  content: GeneratedContent;
  subunitId: string;
};

const superscripts: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻"
};

const subscripts: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋"
};

function toScript(value: string, map: Record<string, string>) {
  return value.split("").map((char) => map[char] || char).join("");
}

function formatMathText(value: unknown) {
  return String(value ?? "")
    .replace(/\^([+-]?\d+)/g, (_, exponent: string) => toScript(exponent, superscripts))
    .replace(/_([+-]?\d+)/g, (_, subscript: string) => toScript(subscript, subscripts))
    .replace(/\*/g, "×")
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥");
}

function Text({ children }: { children: unknown }) {
  return <>{formatMathText(children)}</>;
}

function escapeHtml(value: unknown) {
  return formatMathText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function listItems(items: unknown[] = []) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청에 실패했습니다.");
  return data as T;
}

function contentToText(content: GeneratedContent) {
  const lines: string[] = [];
  lines.push("[과목별 단원별 성취기준]");
  (content.achievementStandards || []).forEach((item) => {
    lines.push(`- ${item.code} (${item.relation}): ${item.description}`);
  });

  lines.push("", "[개념 요약]");
  (content.summary || []).forEach((item) => lines.push(`- ${formatMathText(item)}`));

  lines.push("", "[확인 퀴즈]");
  (content.checkQuizzes || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${formatMathText(item.question)}`);
    lines.push(`난이도: ${item.difficulty}`);
    lines.push(`유형: ${item.type}`);
    if (item.choices?.length) lines.push(`선택지: ${item.choices.map(formatMathText).join(" / ")}`);
    lines.push(`정답: ${formatMathText(item.answer)}`);
    if (item.explanation) lines.push(`해설: ${formatMathText(item.explanation)}`);
  });

  lines.push("", "[시험대비문항]");
  (content.examQuestions || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${formatMathText(item.question)}`);
    if (item.difficulty) lines.push(`난이도: ${item.difficulty}`);
    lines.push(`정답: ${formatMathText(item.answer)}`);
    lines.push(`풀이 과정: ${formatMathText(item.solution)}`);
  });

  lines.push("", "[논술형 예시 문항]");
  (content.essayQuestions || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${formatMathText(item.title || item.question)}`);
    if (item.scenario) lines.push(`상황: ${formatMathText(item.scenario)}`);
    (item.passages || []).forEach((passage) => lines.push(`${passage.label} ${formatMathText(passage.text)}`));
    (item.subQuestions || []).forEach((subQuestion) => {
      lines.push(`${subQuestion.number} ${formatMathText(subQuestion.question)}`);
      lines.push(`모범 답안: ${formatMathText(subQuestion.answer)}`);
    });
    if (!item.subQuestions?.length) lines.push(`모범 답안: ${formatMathText(item.modelAnswer)}`);
  });

  lines.push("", "[게임 활동]");
  (content.gameActivities || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${formatMathText(item.title)}`);
    lines.push(`시간: ${item.duration}`);
    if (item.target) lines.push(`목표: ${formatMathText(item.target)}`);
    lines.push(`준비물: ${formatMathText(item.materials)}`);
    lines.push(`진행 방법: ${formatMathText(Array.isArray(item.procedure) ? item.procedure.join(" / ") : item.procedure)}`);
    lines.push(`변형 방법: ${formatMathText(Array.isArray(item.variation) ? item.variation.join(" / ") : item.variation)}`);
    if (item.teacherGuide) lines.push(`교사용 안내: ${formatMathText(item.teacherGuide)}`);
    lines.push(`AI 붙여넣기용 프롬프트: ${formatMathText(item.aiPrompt)}`);
  });

  lines.push("", "[교사용 활용 팁]");
  lines.push(`도입: ${content.teacherTips?.intro || ""}`);
  lines.push(`전개: ${content.teacherTips?.development || ""}`);
  lines.push(`정리: ${content.teacherTips?.wrapUp || ""}`);

  return lines.join("\n");
}

function contentToWordHtml(content: GeneratedContent) {
  const essayHtml = (content.essayQuestions || []).map((item, index) => `
    <h2>논술형 예시 문항 ${index + 1}. ${escapeHtml(item.title || item.question)}</h2>
    ${item.scenario ? `<p><strong>상황</strong>: ${escapeHtml(item.scenario)}</p>` : ""}
    ${(item.passages || []).map((passage) => `<p><strong>${escapeHtml(passage.label)}</strong> ${escapeHtml(passage.text)}</p>`).join("")}
    ${(item.subQuestions || []).map((subQuestion) => `
      <p><strong>${escapeHtml(subQuestion.number)}</strong> ${escapeHtml(subQuestion.question)}</p>
      <p><strong>모범 답안</strong>: ${escapeHtml(subQuestion.answer)}</p>
    `).join("")}
    ${!item.subQuestions?.length ? `<p><strong>모범 답안</strong>: ${escapeHtml(item.modelAnswer)}</p>` : ""}
  `).join("");

  const rubric = content.rubric && typeof content.rubric === "object" && !Array.isArray(content.rubric)
    ? content.rubric as {
      assessmentAreaName?: string;
      totalScore?: number;
      essayRubrics?: Array<{
        essayQuestionIndex?: number;
        essayQuestionTitle?: string;
        rows?: Array<{ criterion?: string; maxScore?: number; high?: string; middle?: string; low?: string }>;
      }>;
    }
    : {};

  const rubricHtml = (rubric.essayRubrics || []).map((essayRubric) => `
    <h3>논술형 문항 ${essayRubric.essayQuestionIndex || ""} ${escapeHtml(essayRubric.essayQuestionTitle || "")}</h3>
    <table>
      <thead>
        <tr><th>평가요소</th><th>배점</th><th>상</th><th>중</th><th>하</th></tr>
      </thead>
      <tbody>
        ${(essayRubric.rows || []).map((row) => `
          <tr>
            <td>${escapeHtml(row.criterion)}</td>
            <td>${escapeHtml(row.maxScore)}점</td>
            <td>${escapeHtml(row.high)}</td>
            <td>${escapeHtml(row.middle)}</td>
            <td>${escapeHtml(row.low)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `).join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>수학교과 통합 웹앱 생성 자료</title>
        <style>
          body { font-family: "Malgun Gothic", "맑은 고딕", Arial, sans-serif; line-height: 1.6; color: #111827; }
          h1 { font-size: 22pt; }
          h2 { margin-top: 24px; font-size: 16pt; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; }
          h3 { margin-top: 18px; font-size: 13pt; }
          p, li { font-size: 11pt; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
          th, td { border: 1px solid #9ca3af; padding: 7px; vertical-align: top; font-size: 10.5pt; }
          th { background: #eef2f7; }
          .box { border: 1px solid #d1d5db; padding: 10px; margin: 8px 0; }
          pre { white-space: pre-wrap; font-family: "Malgun Gothic", "맑은 고딕", Arial, sans-serif; background: #f3f4f6; padding: 10px; }
        </style>
      </head>
      <body>
        <h1>수학교과 통합 웹앱 생성 자료</h1>

        <h2>과목별 단원별 성취기준</h2>
        ${(content.achievementStandards || []).map((item) => `<p><strong>${escapeHtml(item.code)}</strong> ${escapeHtml(item.description)} (${escapeHtml(item.relation)})</p>`).join("")}

        <h2>개념 요약</h2>
        <ul>${listItems(content.summary || [])}</ul>

        <h2>확인 퀴즈</h2>
        ${(content.checkQuizzes || []).map((item, index) => `
          <div class="box">
            <p><strong>${index + 1}. ${escapeHtml(item.question)}</strong></p>
            <p>난이도: ${escapeHtml(item.difficulty)} / 유형: ${escapeHtml(item.type)}</p>
            ${item.choices?.length ? `<p>선택지: ${item.choices.map(escapeHtml).join(" / ")}</p>` : ""}
            <p>정답: ${escapeHtml(item.answer)}</p>
            ${item.explanation ? `<p>해설: ${escapeHtml(item.explanation)}</p>` : ""}
          </div>
        `).join("")}

        <h2>시험대비문항</h2>
        ${(content.examQuestions || []).map((item, index) => `
          <div class="box">
            <p><strong>${index + 1}. ${escapeHtml(item.question)}</strong></p>
            ${item.difficulty ? `<p>난이도: ${escapeHtml(item.difficulty)}</p>` : ""}
            <p>정답: ${escapeHtml(item.answer)}</p>
            <p>풀이 과정: ${escapeHtml(item.solution)}</p>
          </div>
        `).join("")}

        <h2>논술형 예시 문항</h2>
        ${essayHtml}

        <h2>논술형 채점 루브릭</h2>
        <p><strong>평가 영역명</strong>: ${escapeHtml(rubric.assessmentAreaName || "")}</p>
        <p><strong>영역 만점</strong>: ${escapeHtml(rubric.totalScore || "")}점</p>
        ${rubricHtml}

        <h2>게임 활동</h2>
        ${(content.gameActivities || []).map((item, index) => `
          <div class="box">
            <h3>${index + 1}. ${escapeHtml(item.title)}</h3>
            <p>시간: ${escapeHtml(item.duration)}</p>
            ${item.target ? `<p>목표: ${escapeHtml(item.target)}</p>` : ""}
            <p>준비물: ${escapeHtml(item.materials)}</p>
            <p><strong>진행 방법</strong></p>
            ${Array.isArray(item.procedure) ? `<ol>${listItems(item.procedure)}</ol>` : `<p>${escapeHtml(item.procedure)}</p>`}
            <p><strong>변형 방법</strong></p>
            ${Array.isArray(item.variation) ? `<ul>${listItems(item.variation)}</ul>` : `<p>${escapeHtml(item.variation)}</p>`}
            ${item.teacherGuide ? `<p><strong>교사용 안내</strong>: ${escapeHtml(item.teacherGuide)}</p>` : ""}
            <p><strong>AI 붙여넣기용 프롬프트</strong></p>
            <pre>${escapeHtml(item.aiPrompt)}</pre>
          </div>
        `).join("")}

        <h2>교사용 활용 팁</h2>
        <p><strong>도입</strong>: ${escapeHtml(content.teacherTips?.intro || "")}</p>
        <p><strong>전개</strong>: ${escapeHtml(content.teacherTips?.development || "")}</p>
        <p><strong>정리</strong>: ${escapeHtml(content.teacherTips?.wrapUp || "")}</p>
      </body>
    </html>
  `;
}

function RubricView({ rubric }: { rubric: unknown }) {
  if (!rubric || typeof rubric !== "object" || Array.isArray(rubric)) {
    return <pre className="json-box">{JSON.stringify(rubric, null, 2)}</pre>;
  }

  const data = rubric as {
    assessmentAreaName?: string;
    totalScore?: number;
    achievementStandards?: string[];
    achievementLevels?: { high?: string; middle?: string; low?: string };
    assessmentMethods?: string[];
    assessmentElements?: Array<{ name: string; maxScore: number }>;
    scoringRubric?: Array<{
      element: string;
      maxScore: number;
      levels: Array<{ score: number; description: string }>;
    }>;
    essayRubrics?: Array<{
      essayQuestionIndex?: number;
      essayQuestionTitle?: string;
      rows?: Array<{
        criterion?: string;
        maxScore?: number;
        high?: string;
        middle?: string;
        low?: string;
      }>;
    }>;
    baseScore?: { submittedBlank?: number; notSubmitted?: number; excusedAbsent?: number };
  };

  return (
    <div className="stack-sm">
      <p><strong>평가 영역명</strong>: <Text>{data.assessmentAreaName}</Text></p>
      <p><strong>영역 만점</strong>: {data.totalScore}점</p>
      <p><strong>평가방법</strong>: {(data.assessmentMethods || []).join(" / ")}</p>
      <div>
        <strong>성취기준</strong>
        <ul>{(data.achievementStandards || []).map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <div>
        <strong>평가기준</strong>
        <p>상: <Text>{data.achievementLevels?.high}</Text></p>
        <p>중: <Text>{data.achievementLevels?.middle}</Text></p>
        <p>하: <Text>{data.achievementLevels?.low}</Text></p>
      </div>
      {(data.essayRubrics || []).map((essayRubric, index) => (
        <div className="question-card" key={`${essayRubric.essayQuestionIndex}-${index}`}>
          <strong>
            논술형 문항 {essayRubric.essayQuestionIndex || index + 1}
            {essayRubric.essayQuestionTitle ? <>: <Text>{essayRubric.essayQuestionTitle}</Text></> : ""}
          </strong>
          <div className="table-wrap">
            <table className="data-table rubric-table">
              <thead>
                <tr>
                  <th>평가요소</th>
                  <th>배점</th>
                  <th>상</th>
                  <th>중</th>
                  <th>하</th>
                </tr>
              </thead>
              <tbody>
                {(essayRubric.rows || []).map((row) => (
                  <tr key={row.criterion}>
                    <td><Text>{row.criterion}</Text></td>
                    <td>{row.maxScore}점</td>
                    <td><Text>{row.high}</Text></td>
                    <td><Text>{row.middle}</Text></td>
                    <td><Text>{row.low}</Text></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {(data.scoringRubric || []).map((item) => (
        <div className="question-card" key={item.element}>
          <strong><Text>{item.element}</Text> ({item.maxScore}점)</strong>
          {(item.levels || []).map((level) => (
            <p key={level.score}>{level.score}점: <Text>{level.description}</Text></p>
          ))}
        </div>
      ))}
      <div>
        <strong>기본점수 및 미응시 처리</strong>
        <p>백지 또는 자발적 미참여: {data.baseScore?.submittedBlank}점</p>
        <p>미제출: {data.baseScore?.notSubmitted}점</p>
        <p>장기 미인정결 등 미응시: {data.baseScore?.excusedAbsent}점</p>
      </div>
    </div>
  );
}

function GeneratedContentView({
  content,
  focusedGenerating,
  onGenerateSection
}: {
  content: GeneratedContent;
  focusedGenerating: "" | "exam" | "essay" | "game" | "all";
  onGenerateSection: (section: "exam" | "essay" | "game") => void;
}) {
  const hasAnyContent = Boolean(
    content.achievementStandards?.length ||
    content.summary?.length ||
    content.checkQuizzes?.length ||
    content.examQuestions?.length ||
    content.essayQuestions?.length ||
    content.gameActivities?.length ||
    content.teacherTips?.intro ||
    content.teacherTips?.development ||
    content.teacherTips?.wrapUp
  );

  return (
    <div className="stack">
      {!hasAnyContent ? (
        <section className="panel">
          <h3>생성 결과 확인 필요</h3>
          <p className="notice notice-error">
            AI 결과가 저장되었지만 화면에 표시할 항목을 찾지 못했습니다. 아래 JSON 원본을 확인해 주세요.
          </p>
          <pre className="json-box">{JSON.stringify(content, null, 2)}</pre>
        </section>
      ) : null}

      <section className="panel">
        <h3>과목별 단원별 성취기준</h3>
        {(content.achievementStandards || []).map((item) => (
          <div className="question-card" key={`${item.code}-${item.description}`}>
            <strong>{item.code}</strong>
            <p><Text>{item.description}</Text></p>
            <span className="badge">{item.relation}</span>
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>개념 요약</h3>
        <ul>{(content.summary || []).map((item) => <li key={item}><Text>{item}</Text></li>)}</ul>
      </section>

      <section className="panel">
        <h3>확인 퀴즈</h3>
        {(content.checkQuizzes || []).map((item, index) => (
          <div className="question-card" key={`${item.question}-${index}`}>
            <strong>{index + 1}. <Text>{item.question}</Text></strong>
            <p>난이도: {item.difficulty} / 유형: {item.type}</p>
            {item.choices?.length ? <p>선택지: <Text>{item.choices.join(" / ")}</Text></p> : null}
            <p>정답: <Text>{item.answer}</Text></p>
            {item.explanation ? <p>해설: <Text>{item.explanation}</Text></p> : null}
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>시험대비문항</h3>
            <p className="muted">학교 시험형 문항만 깊게 새로 개발할 수 있습니다.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => onGenerateSection("exam")} disabled={focusedGenerating !== ""}>
            {focusedGenerating === "exam" ? "생성중..." : "시험대비문항 새로 개발"}
          </button>
        </div>
        {(content.examQuestions || []).map((item, index) => (
          <div className="question-card" key={`${item.question}-${index}`}>
            <strong>{index + 1}. <Text>{item.question}</Text></strong>
            {item.difficulty ? <p>난이도: {item.difficulty}</p> : null}
            <p>정답: <Text>{item.answer}</Text></p>
            <p>풀이 과정: <Text>{item.solution}</Text></p>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>논술형 예시 문항</h3>
            <p className="muted">평가문항지형 논술형 문항과 루브릭을 함께 새로 개발합니다.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => onGenerateSection("essay")} disabled={focusedGenerating !== ""}>
            {focusedGenerating === "essay" ? "생성중..." : "고품질 논술형 새로 개발"}
          </button>
        </div>
        {(content.essayQuestions || []).map((item, index) => (
          <div className="question-card" key={`${item.question}-${index}`}>
            <strong>{index + 1}. <Text>{item.title || item.question}</Text></strong>
            {item.scenario ? <p><strong>상황</strong>: <Text>{item.scenario}</Text></p> : null}
            {item.passages?.length ? (
              <div className="passage-list">
                {item.passages.map((passage) => (
                  <p key={`${passage.label}-${passage.text}`}>
                    <strong>{passage.label}</strong> <Text>{passage.text}</Text>
                  </p>
                ))}
              </div>
            ) : null}
            {item.subQuestions?.length ? (
              <div className="stack-sm">
                {item.subQuestions.map((subQuestion) => (
                  <div className="sub-question" key={`${subQuestion.number}-${subQuestion.question}`}>
                    <p><strong>{subQuestion.number}</strong> <Text>{subQuestion.question}</Text></p>
                    <p><strong>모범 답안</strong>: <Text>{subQuestion.answer}</Text></p>
                  </div>
                ))}
              </div>
            ) : (
              <p>모범 답안: <Text>{item.modelAnswer}</Text></p>
            )}
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>논술형 채점 루브릭</h3>
        <RubricView rubric={content.rubric} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>게임 활동</h3>
            <p className="muted">수업 활동과 바이브코딩용 한글 프롬프트를 새로 개발합니다.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => onGenerateSection("game")} disabled={focusedGenerating !== ""}>
            {focusedGenerating === "game" ? "생성중..." : "수업 게임활동 새로 개발"}
          </button>
        </div>
        {(content.gameActivities || []).map((item, index) => (
          <div className="question-card" key={`${item.title}-${index}`}>
            <strong><Text>{item.title}</Text></strong>
            <p>시간: {item.duration}</p>
            {item.target ? <p>목표: <Text>{item.target}</Text></p> : null}
            <p>준비물: <Text>{item.materials}</Text></p>
            <div>
              <strong>진행 방법</strong>
              {Array.isArray(item.procedure) ? (
                <ol>{item.procedure.map((step) => <li key={step}><Text>{step}</Text></li>)}</ol>
              ) : (
                <p><Text>{item.procedure}</Text></p>
              )}
            </div>
            <div>
              <strong>변형 방법</strong>
              {Array.isArray(item.variation) ? (
                <ul>{item.variation.map((variation) => <li key={variation}><Text>{variation}</Text></li>)}</ul>
              ) : (
                <p><Text>{item.variation}</Text></p>
              )}
            </div>
            {item.teacherGuide ? <p><strong>교사용 안내</strong>: <Text>{item.teacherGuide}</Text></p> : null}
            <p><strong>AI 붙여넣기용 프롬프트</strong></p>
            <pre className="prompt-box">{formatMathText(item.aiPrompt)}</pre>
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>교사용 활용 팁</h3>
        <p><strong>도입</strong>: <Text>{content.teacherTips?.intro}</Text></p>
        <p><strong>전개</strong>: <Text>{content.teacherTips?.development}</Text></p>
        <p><strong>정리</strong>: <Text>{content.teacherTips?.wrapUp}</Text></p>
      </section>
    </div>
  );
}

export function TeacherDashboard() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [notice, setNotice] = useState<Notice>({ tone: "normal", message: "" });
  const [gradeId, setGradeId] = useState("");
  const [publisherId, setPublisherId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [subunitId, setSubunitId] = useState("");
  const [result, setResult] = useState<RenderedResult | null>(null);
  const [focusedGenerating, setFocusedGenerating] = useState<"" | "exam" | "essay" | "game" | "all">("");

  async function refresh() {
    const nextData = await apiRequest<BootstrapData>("/api/bootstrap");
    setData(nextData);
  }

  useEffect(() => {
    refresh().catch((error) => setNotice({ tone: "error", message: error.message }));
  }, []);

  const publishers = useMemo(() => {
    if (!data || !gradeId) return [];
    return data.publishers.filter((publisher) =>
      data.units.some((unit) => unit.gradeId === gradeId && unit.publisherId === publisher.id)
    );
  }, [data, gradeId]);

  const units = useMemo(() => {
    if (!data) return [];
    return data.units.filter((unit) =>
      (!gradeId || unit.gradeId === gradeId) && (!publisherId || unit.publisherId === publisherId)
    );
  }, [data, gradeId, publisherId]);

  const subunits = useMemo(() => {
    if (!data || !unitId) return [];
    return data.subunits.filter((subunit) => subunit.unitId === unitId);
  }, [data, unitId]);

  async function generate(force = false) {
    if (!subunitId) {
      setNotice({ tone: "error", message: "소단원을 선택해 주세요." });
      return;
    }
    try {
      setNotice({ tone: "normal", message: force ? "기존 결과를 지우고 다시 생성하는 중입니다." : "AI 자료를 불러오거나 생성하는 중입니다." });
      const response = await apiRequest<{
        content: GeneratedContent;
        cached?: boolean;
      }>("/api/generate", {
        method: "POST",
        body: JSON.stringify({ subunitId, force })
      });
      setResult({ content: response.content, subunitId });
      setNotice({
        tone: "normal",
        message: response.cached ? "저장된 AI 결과를 불러왔습니다." : "AI 생성 결과를 저장했습니다."
      });
      await refresh();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "생성 실패" });
    }
  }

  async function generateSection(section: "exam" | "essay" | "game") {
    if (!subunitId) {
      setNotice({ tone: "error", message: "소단원을 선택해 주세요." });
      return;
    }

    const sectionNames = {
      exam: "시험대비문항",
      essay: "논술형 문항과 루브릭",
      game: "게임활동"
    };

    try {
      setFocusedGenerating(section);
      setNotice({ tone: "normal", message: `${sectionNames[section]}만 깊게 다시 생성하는 중입니다.` });
      const response = await apiRequest<{
        content: GeneratedContent;
        section: string;
      }>("/api/generate-section", {
        method: "POST",
        body: JSON.stringify({ subunitId, section })
      });
      setResult({ content: response.content, subunitId });
      setNotice({ tone: "normal", message: `${sectionNames[section]}을 다시 생성해 저장했습니다.` });
      await refresh();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "섹션 생성 실패" });
    } finally {
      setFocusedGenerating("");
    }
  }

  async function generateFinalPackage() {
    if (!subunitId) {
      setNotice({ tone: "error", message: "소단원을 선택해 주세요." });
      return;
    }

    try {
      setFocusedGenerating("all");
      setNotice({ tone: "normal", message: "최종 고품질 자료를 생성하는 중입니다. 초안 생성 후 시험대비, 논술형, 게임활동을 순서대로 새로 개발합니다." });

      const draft = await apiRequest<{ content: GeneratedContent }>("/api/generate", {
        method: "POST",
        body: JSON.stringify({ subunitId, force: true })
      });
      let nextContent = draft.content;
      setResult({ content: nextContent, subunitId });

      for (const section of ["exam", "essay", "game"] as const) {
        const sectionNames = {
          exam: "시험대비문항",
          essay: "논술형 문항과 루브릭",
          game: "게임활동"
        };
        setNotice({ tone: "normal", message: `${sectionNames[section]}을 새로 개발하는 중입니다.` });
        const response = await apiRequest<{ content: GeneratedContent }>("/api/generate-section", {
          method: "POST",
          body: JSON.stringify({ subunitId, section })
        });
        nextContent = response.content;
        setResult({ content: nextContent, subunitId });
      }

      setNotice({ tone: "normal", message: "최종 고품질 자료를 저장했습니다." });
      await refresh();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "최종 자료 생성 실패" });
    } finally {
      setFocusedGenerating("");
    }
  }

  async function copyResult() {
    if (!result) {
      setNotice({ tone: "error", message: "복사할 결과가 없습니다." });
      return;
    }
    await navigator.clipboard.writeText(contentToText(result.content));
    setNotice({ tone: "normal", message: "결과를 클립보드에 복사했습니다." });
  }

  function exportWord() {
    if (!result) {
      setNotice({ tone: "error", message: "내보낼 결과가 없습니다." });
      return;
    }

    const selectedSubunit = data?.subunits.find((item) => item.id === result.subunitId);
    const fileName = `${selectedSubunit?.title || "수학_수업자료"}.doc`;
    const blob = new Blob(["\ufeff", contentToWordHtml(result.content)], {
      type: "application/msword;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice({ tone: "normal", message: "Word 파일로 내보냈습니다." });
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="grid-4">
          <label>
            학년
            <select value={gradeId} onChange={(event) => {
              setGradeId(event.target.value);
              setPublisherId("");
              setUnitId("");
              setSubunitId("");
            }}>
              <option value="">학년 선택</option>
              {(data?.grades || []).map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
            </select>
          </label>
          <label>
            출판사
            <select value={publisherId} onChange={(event) => {
              setPublisherId(event.target.value);
              setUnitId("");
              setSubunitId("");
            }}>
              <option value="">출판사 선택</option>
              {publishers.map((publisher) => <option key={publisher.id} value={publisher.id}>{publisher.name}</option>)}
            </select>
          </label>
          <label>
            대단원
            <select value={unitId} onChange={(event) => {
              setUnitId(event.target.value);
              setSubunitId("");
            }}>
              <option value="">대단원 선택</option>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}
            </select>
          </label>
          <label>
            소단원
            <select value={subunitId} onChange={(event) => setSubunitId(event.target.value)}>
              <option value="">소단원 선택</option>
              {subunits.map((subunit) => <option key={subunit.id} value={subunit.id}>{subunit.title}</option>)}
            </select>
          </label>
        </div>
        <div className="action-row">
          <button className="primary-button" type="button" onClick={() => generate(false)} disabled={focusedGenerating !== ""}>
            초안 생성
          </button>
          <button className="secondary-button" type="button" onClick={generateFinalPackage} disabled={focusedGenerating !== ""}>
            {focusedGenerating === "all" ? "최종 생성중..." : "최종 고품질 자료 생성"}
          </button>
          <button className="secondary-button" type="button" onClick={() => generate(true)} disabled={focusedGenerating !== ""}>
            초안 다시 생성
          </button>
          <button className="secondary-button" type="button" onClick={exportWord}>워드로 내보내기</button>
          <button className="secondary-button" type="button" onClick={copyResult}>결과 복사</button>
          <button className="secondary-button" type="button" onClick={() => window.print()}>인쇄</button>
        </div>
        <p className={`notice ${notice.tone === "error" ? "notice-error" : ""}`}>{notice.message}</p>
      </section>

      {result ? (
        <GeneratedContentView
          content={result.content}
          focusedGenerating={focusedGenerating}
          onGenerateSection={generateSection}
        />
      ) : (
        <section className="panel">
          <p>소단원을 선택하고 자료를 생성하면 여기에 결과가 표시됩니다.</p>
        </section>
      )}
    </div>
  );
}
