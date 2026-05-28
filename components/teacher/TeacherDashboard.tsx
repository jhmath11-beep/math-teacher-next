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
  (content.summary || []).forEach((item) => lines.push(`- ${item}`));

  lines.push("", "[확인 퀴즈]");
  (content.checkQuizzes || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.question}`);
    lines.push(`난이도: ${item.difficulty}`);
    lines.push(`유형: ${item.type}`);
    if (item.choices?.length) lines.push(`선택지: ${item.choices.join(" / ")}`);
    lines.push(`정답: ${item.answer}`);
    if (item.explanation) lines.push(`해설: ${item.explanation}`);
  });

  lines.push("", "[시험대비문항]");
  (content.examQuestions || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.question}`);
    lines.push(`정답: ${item.answer}`);
    lines.push(`풀이 과정: ${item.solution}`);
  });

  lines.push("", "[논술형 예시 문항]");
  (content.essayQuestions || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.question}`);
    lines.push(`모범 답안: ${item.modelAnswer}`);
  });

  lines.push("", "[게임 활동]");
  (content.gameActivities || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title}`);
    lines.push(`시간: ${item.duration}`);
    lines.push(`준비물: ${item.materials}`);
    lines.push(`진행 방법: ${item.procedure}`);
    lines.push(`변형 방법: ${item.variation}`);
    lines.push(`AI 붙여넣기용 프롬프트: ${item.aiPrompt}`);
  });

  lines.push("", "[교사용 활용 팁]");
  lines.push(`도입: ${content.teacherTips?.intro || ""}`);
  lines.push(`전개: ${content.teacherTips?.development || ""}`);
  lines.push(`정리: ${content.teacherTips?.wrapUp || ""}`);

  return lines.join("\n");
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
    baseScore?: { submittedBlank?: number; notSubmitted?: number; excusedAbsent?: number };
  };

  return (
    <div className="stack-sm">
      <p><strong>평가 영역명</strong>: {data.assessmentAreaName}</p>
      <p><strong>영역 만점</strong>: {data.totalScore}점</p>
      <p><strong>평가방법</strong>: {(data.assessmentMethods || []).join(" / ")}</p>
      <div>
        <strong>성취기준</strong>
        <ul>{(data.achievementStandards || []).map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <div>
        <strong>평가기준</strong>
        <p>상: {data.achievementLevels?.high}</p>
        <p>중: {data.achievementLevels?.middle}</p>
        <p>하: {data.achievementLevels?.low}</p>
      </div>
      {(data.scoringRubric || []).map((item) => (
        <div className="question-card" key={item.element}>
          <strong>{item.element} ({item.maxScore}점)</strong>
          {(item.levels || []).map((level) => (
            <p key={level.score}>{level.score}점: {level.description}</p>
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

function GeneratedContentView({ content }: { content: GeneratedContent }) {
  return (
    <div className="stack">
      <section className="panel">
        <h3>과목별 단원별 성취기준</h3>
        {(content.achievementStandards || []).map((item) => (
          <div className="question-card" key={`${item.code}-${item.description}`}>
            <strong>{item.code}</strong>
            <p>{item.description}</p>
            <span className="badge">{item.relation}</span>
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>개념 요약</h3>
        <ul>{(content.summary || []).map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section className="panel">
        <h3>확인 퀴즈</h3>
        {(content.checkQuizzes || []).map((item, index) => (
          <div className="question-card" key={`${item.question}-${index}`}>
            <strong>{index + 1}. {item.question}</strong>
            <p>난이도: {item.difficulty} / 유형: {item.type}</p>
            {item.choices?.length ? <p>선택지: {item.choices.join(" / ")}</p> : null}
            <p>정답: {item.answer}</p>
            {item.explanation ? <p>해설: {item.explanation}</p> : null}
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>시험대비문항</h3>
        {(content.examQuestions || []).map((item, index) => (
          <div className="question-card" key={`${item.question}-${index}`}>
            <strong>{index + 1}. {item.question}</strong>
            <p>정답: {item.answer}</p>
            <p>풀이 과정: {item.solution}</p>
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>논술형 예시 문항</h3>
        {(content.essayQuestions || []).map((item, index) => (
          <div className="question-card" key={`${item.question}-${index}`}>
            <strong>{index + 1}. {item.question}</strong>
            <p>모범 답안: {item.modelAnswer}</p>
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>논술형 채점 루브릭</h3>
        <RubricView rubric={content.rubric} />
      </section>

      <section className="panel">
        <h3>게임 활동</h3>
        {(content.gameActivities || []).map((item, index) => (
          <div className="question-card" key={`${item.title}-${index}`}>
            <strong>{item.title}</strong>
            <p>시간: {item.duration}</p>
            <p>준비물: {item.materials}</p>
            <p>진행 방법: {item.procedure}</p>
            <p>변형 방법: {item.variation}</p>
            <p><strong>AI 붙여넣기용 프롬프트</strong></p>
            <pre className="prompt-box">{item.aiPrompt}</pre>
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>교사용 활용 팁</h3>
        <p><strong>도입</strong>: {content.teacherTips?.intro}</p>
        <p><strong>전개</strong>: {content.teacherTips?.development}</p>
        <p><strong>정리</strong>: {content.teacherTips?.wrapUp}</p>
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
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

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

  async function generate() {
    if (!subunitId) {
      setNotice({ tone: "error", message: "소단원을 선택해 주세요." });
      return;
    }
    try {
      setNotice({ tone: "normal", message: "AI 자료를 불러오거나 생성하는 중입니다." });
      const response = await apiRequest<{
        content: GeneratedContent;
        cached?: boolean;
      }>("/api/generate", {
        method: "POST",
        body: JSON.stringify({ subunitId })
      });
      setResult({ content: response.content, subunitId });
      setIsEditing(false);
      setNotice({
        tone: "normal",
        message: response.cached ? "저장된 AI 결과를 불러왔습니다." : "AI 생성 결과를 저장했습니다."
      });
      await refresh();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "생성 실패" });
    }
  }

  async function saveEdit() {
    if (!result) return;
    try {
      const content = JSON.parse(editText) as GeneratedContent;
      await apiRequest("/api/save-generated", {
        method: "POST",
        body: JSON.stringify({ subunitId: result.subunitId, content })
      });
      setResult({ ...result, content });
      setIsEditing(false);
      setNotice({ tone: "normal", message: "수정 결과를 저장했습니다." });
      await refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof SyntaxError ? "JSON 형식을 확인해 주세요." : error instanceof Error ? error.message : "저장 실패"
      });
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
          <button className="primary-button" type="button" onClick={generate}>저장 텍스트로 자료 생성</button>
          <button className="secondary-button" type="button" onClick={() => {
            if (!result) return;
            setEditText(JSON.stringify(result.content, null, 2));
            setIsEditing(true);
          }}>편집</button>
          <button className="secondary-button" type="button" onClick={copyResult}>결과 복사</button>
          <button className="secondary-button" type="button" onClick={() => window.print()}>인쇄</button>
        </div>
        <p className={`notice ${notice.tone === "error" ? "notice-error" : ""}`}>{notice.message}</p>
      </section>

      {isEditing ? (
        <section className="panel">
          <h3>생성 결과 JSON 편집</h3>
          <textarea className="json-editor" value={editText} onChange={(event) => setEditText(event.target.value)} />
          <div className="action-row">
            <button className="primary-button" type="button" onClick={saveEdit}>수정 저장</button>
            <button className="secondary-button" type="button" onClick={() => setIsEditing(false)}>편집 취소</button>
          </div>
        </section>
      ) : null}

      {result ? <GeneratedContentView content={result.content} /> : (
        <section className="panel">
          <p>소단원을 선택하고 자료를 생성하면 여기에 결과가 표시됩니다.</p>
        </section>
      )}
    </div>
  );
}
