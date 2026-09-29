"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
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

// 논술형 마크다운(제목/제시문/표 등)을 HTML로 변환한다. 수식($...$)은 MathJax가 조판한다.
// 입력은 우리 AI 응답이지만 안전을 위해 텍스트는 escape한 뒤 마크다운 패턴만 허용한다.
function renderMarkdownToHtml(md: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => escape(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const splitRow = (line: string) => {
    const cells = line.split("|");
    if (cells[0].trim() === "") cells.shift();
    if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
    return cells.map((c) => c.trim());
  };
  const lines = String(md).replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /-/.test(lines[i + 1]) && /^[\s|:-]+$/.test(lines[i + 1])) {
      const headers = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      out.push(
        `<div class="table-wrap"><table class="data-table rubric-table"><thead><tr>${headers
          .map((h) => `<th>${inline(h)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      );
      continue;
    }
    if (/^###\s+/.test(line)) { out.push(`<h4 class="md-h4">${inline(line.replace(/^###\s+/, ""))}</h4>`); i += 1; continue; }
    if (/^##\s+/.test(line)) { out.push(`<h3 class="md-h3">${inline(line.replace(/^##\s+/, ""))}</h3>`); i += 1; continue; }
    if (/^#\s+/.test(line)) { out.push(`<h2 class="md-h2">${inline(line.replace(/^#\s+/, ""))}</h2>`); i += 1; continue; }
    if (/^\s*---+\s*$/.test(line)) { out.push("<hr/>"); i += 1; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (line.trim() === "") { i += 1; continue; }
    out.push(`<p>${inline(line)}</p>`);
    i += 1;
  }
  return out.join("");
}

// 리렌더 때 innerHTML이 다시 써지면 MathJax가 조판한 수식이 원문($...$)으로 되돌아간다.
// 마크다운이 바뀔 때만 다시 그리도록 memo로 고정한다.
const MarkdownBody = memo(function MarkdownBody({ md }: { md: string }) {
  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(md) }} />;
});

// 문항 본문에 마크다운 표가 섞여 오면 표로 그린다(그 외에는 기존처럼 굵은 한 줄 텍스트).
const hasMarkdownTable = (text: string) => /^\s*\|.*\|\s*$/m.test(text);
const numberedMarkdown = (index: number, text: string) => `**${index + 1}.** ${text}`;

function QuestionTitle({ index, text }: { index: number; text: unknown }) {
  const raw = String(text ?? "");
  if (hasMarkdownTable(raw)) return <MarkdownBody md={numberedMarkdown(index, raw)} />;
  return <strong>{index + 1}. <Text>{raw}</Text></strong>;
}

// 인쇄/워드용 HTML에서도 같은 규칙으로 문항 제목을 만든다.
function questionTitleHtml(index: number, text: unknown) {
  const raw = String(text ?? "");
  if (hasMarkdownTable(raw)) return renderMarkdownToHtml(numberedMarkdown(index, raw));
  return `<p><strong>${index + 1}. ${escapeHtml(raw)}</strong></p>`;
}

// 내보내기/복사용: LaTeX 인라인 수식($...$)을 한글·워드에서 읽히는 유니코드 텍스트로 변환한다.
// (화면·인쇄는 MathJax가 조판하므로 변환하지 않는다.)
function texToUnicode(tex: string): string {
  const sup: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", n: "ⁿ", x: "ˣ", a: "ᵃ", b: "ᵇ" };
  const sub: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋" };
  const toScriptOr = (g: string, map: Record<string, string>, caret: string) =>
    [...g].every((c) => map[c]) ? [...g].map((c) => map[c]).join("") : `${caret}(${g})`;
  const cmd: Record<string, string> = {
    times: "×", div: "÷", le: "≤", leq: "≤", ge: "≥", geq: "≥", neq: "≠", ne: "≠", pm: "±", mp: "∓",
    cdot: "·", triangle: "△", angle: "∠", pi: "π", alpha: "α", beta: "β", gamma: "γ", theta: "θ",
    infty: "∞", cong: "≅", sim: "∼", approx: "≈", parallel: "∥", perp: "⊥", ldots: "…", cdots: "⋯",
    leftrightarrow: "↔", rightarrow: "→", to: "→", Rightarrow: "⇒", overline: "", mathrm: "", left: "", right: "", quad: " ", qquad: "  "
  };
  let s = tex;
  s = s.replace(/\^\{?\s*\\circ\s*\}?/g, "°"); // 50^\circ → 50°
  // 분수보다 먼저 처리해야 분자/분모 안의 근호·윗줄이 살아남는다.
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)").replace(/\\sqrt\s*(\w)/g, "√$1");
  s = s.replace(/\\overline\s*\{([^{}]*)\}/g, "$1̅");
  s = s.replace(/\\mathrm\s*\{([^{}]*)\}/g, "$1");
  // 분수는 중첩(분자에 또 분수)까지 잡도록 여러 번 적용한다.
  for (let i = 0; i < 4; i += 1) {
    const next = s.replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_m, a, b) => `(${a})/(${b})`);
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\\([a-zA-Z]+)/g, (_m, name: string) => (cmd[name] !== undefined ? cmd[name] : ""));
  s = s.replace(/\^\{([^{}]*)\}/g, (_m, g: string) => toScriptOr(g, sup, "^"));
  s = s.replace(/\^(\w)/g, (_m, g: string) => toScriptOr(g, sup, "^"));
  s = s.replace(/_\{([^{}]*)\}/g, (_m, g: string) => toScriptOr(g, sub, "_"));
  s = s.replace(/_(\w)/g, (_m, g: string) => toScriptOr(g, sub, "_"));
  s = s.replace(/[{}]/g, "").replace(/\\[ ,;!]/g, " ").replace(/\\/g, "");
  return s;
}

// 문자열 전체에서 $...$ 구간만 유니코드 수식으로 치환한다.
function mathToUnicode(str: string): string {
  return String(str).replace(/\$([^$]*)\$/g, (_m, tex: string) => texToUnicode(tex));
}

const CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

// 보기 텍스트에 이미 ①~⑩ 번호가 있으면 그대로, 없으면 순번을 붙인다.
function choiceLabel(choice: unknown, index: number) {
  const text = formatMathText(choice);
  return /^\s*[①-⑩]/.test(text) ? text : `${CIRCLED_NUMBERS[index] || `${index + 1}.`} ${text}`;
}

function formatMathText(value: unknown) {
  // 수식은 LaTeX 인라인($...$)으로 들어오므로 원문을 보존하고 MathJax가 조판한다.
  // $ 밖의 일반 텍스트에 섞인 옛 표기(^2 등)만 가볍게 보정하되, $...$ 안은 손대지 않는다.
  const raw = String(value ?? "");
  if (raw.includes("$")) return raw; // LaTeX 포함 → 원문 그대로(MathJax가 처리)
  return raw
    .replace(/\^([+-]?\d+)/g, (_, exponent: string) => toScript(exponent, superscripts))
    .replace(/_([+-]?\d+)/g, (_, subscript: string) => toScript(subscript, subscripts))
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

function escapeXml(value: unknown) {
  return formatMathText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listItems(items: unknown[] = []) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function docxText(value: unknown) {
  return `<w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
}

function docxParagraph(value: unknown, options: { bold?: boolean; size?: number; heading?: boolean } = {}) {
  const size = options.size || (options.heading ? 28 : 22);
  return `
    <w:p>
      <w:pPr>
        <w:spacing w:after="${options.heading ? 180 : 80}" />
      </w:pPr>
      <w:r>
        <w:rPr>
          ${options.bold || options.heading ? "<w:b />" : ""}
          <w:sz w:val="${size}" />
        </w:rPr>
        <w:t xml:space="preserve">${escapeXml(value)}</w:t>
      </w:r>
    </w:p>
  `;
}

function docxBullet(value: unknown) {
  return docxParagraph(`- ${formatMathText(value)}`);
}

function docxCell(value: unknown) {
  return `
    <w:tc>
      <w:tcPr><w:tcW w:w="2200" w:type="dxa" /></w:tcPr>
      ${docxParagraph(value)}
    </w:tc>
  `;
}

function docxTable(rows: unknown[][]) {
  return `
    <w:tbl>
      <w:tblPr>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="888888" />
          <w:left w:val="single" w:sz="4" w:space="0" w:color="888888" />
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="888888" />
          <w:right w:val="single" w:sz="4" w:space="0" w:color="888888" />
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="888888" />
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="888888" />
        </w:tblBorders>
      </w:tblPr>
      ${rows.map((row) => `<w:tr>${row.map(docxCell).join("")}</w:tr>`).join("")}
    </w:tbl>
  `;
}

function contentToDocxDocumentXml(content: GeneratedContent, sel: SectionSel = ALL_SECTIONS, meta: ExportMeta = {}) {
  const head = unitHeaderText(meta);
  const parts: string[] = [];
  parts.push(docxParagraph(head.title, { heading: true, size: 36 }));
  if (head.sub) parts.push(docxParagraph(head.sub));

  parts.push(docxParagraph("과목별 단원별 성취기준", { heading: true }));
  (content.achievementStandards || []).forEach((item) => {
    parts.push(docxParagraph(`${item.code} ${item.description} (${item.relation})`));
  });

  if (content.summary?.length) {
    parts.push(docxParagraph("개념 요약", { heading: true }));
    content.summary.forEach((item) => parts.push(docxBullet(item)));
  }

  if (sel.check) {
    parts.push(docxParagraph("확인 퀴즈", { heading: true }));
    (content.checkQuizzes || []).forEach((item, index) => {
      parts.push(docxParagraph(`${index + 1}. ${item.question}`, { bold: true }));
      parts.push(docxParagraph(`난이도: ${item.difficulty} / 유형: ${item.type}`));
      if (item.choices?.length) parts.push(docxParagraph(`선택지: ${item.choices.join(" / ")}`));
      parts.push(docxParagraph(`정답: ${item.answer}`));
      if (item.explanation) parts.push(docxParagraph(`해설: ${item.explanation}`));
    });
  }

  if (sel.exam) {
    parts.push(docxParagraph("시험대비문항", { heading: true }));
    (content.examQuestions || []).forEach((item, index) => {
      parts.push(docxParagraph(`${index + 1}. ${item.question}`, { bold: true }));
      if (item.difficulty) parts.push(docxParagraph(`난이도: ${item.difficulty}`));
      if (item.choices?.length) item.choices.forEach((choice, ci) => parts.push(docxParagraph(choiceLabel(choice, ci))));
      parts.push(docxParagraph(`정답: ${item.answer}`));
      parts.push(docxParagraph(`풀이 과정: ${item.solution}`));
    });
  }

  if (sel.essay) {
    parts.push(docxParagraph("논술형 평가 문항", { heading: true }));
    if (content.essayMarkdown) {
      content.essayMarkdown.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (/^#{1,3}\s+/.test(trimmed)) parts.push(docxParagraph(trimmed.replace(/^#{1,3}\s+/, ""), { bold: true, size: 26 }));
        else parts.push(docxParagraph(trimmed.replace(/\*\*/g, "")));
      });
    } else {
      (content.essayQuestions || []).forEach((item, index) => {
        parts.push(docxParagraph(`${index + 1}. ${item.title || item.question}`, { bold: true, size: 26 }));
        if (item.scenario) parts.push(docxParagraph(`상황: ${item.scenario}`));
        (item.passages || []).forEach((passage) => parts.push(docxParagraph(`${passage.label} ${passage.text}`)));
        (item.subQuestions || []).forEach((subQuestion) => {
          parts.push(docxParagraph(`${subQuestion.number} ${subQuestion.question}`, { bold: true }));
          parts.push(docxParagraph(`모범 답안: ${subQuestion.answer}`));
        });
        if (!item.subQuestions?.length) parts.push(docxParagraph(`모범 답안: ${item.modelAnswer}`));
      });

      parts.push(docxParagraph("논술형 채점 루브릭", { heading: true }));
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
      parts.push(docxParagraph(`평가 영역명: ${rubric.assessmentAreaName || ""}`));
      parts.push(docxParagraph(`영역 만점: ${rubric.totalScore || ""}점`));
      (rubric.essayRubrics || []).forEach((essayRubric) => {
        parts.push(docxParagraph(`논술형 문항 ${essayRubric.essayQuestionIndex || ""} ${essayRubric.essayQuestionTitle || ""}`, { bold: true }));
        parts.push(docxTable([
          ["평가요소", "배점", "상", "중", "하"],
          ...(essayRubric.rows || []).map((row) => [
            row.criterion || "",
            `${row.maxScore || ""}점`,
            row.high || "",
            row.middle || "",
            row.low || ""
          ])
        ]));
      });
    }
  }

  if (sel.game) {
    parts.push(docxParagraph("게임 활동", { heading: true }));
    (content.gameActivities || []).forEach((item, index) => {
      parts.push(docxParagraph(`${index + 1}. ${item.title}`, { bold: true }));
      parts.push(docxParagraph(`시간: ${item.duration}`));
      if (item.target) parts.push(docxParagraph(`목표: ${item.target}`));
      parts.push(docxParagraph(`준비물: ${item.materials}`));
      parts.push(docxParagraph("진행 방법", { bold: true }));
      if (Array.isArray(item.procedure)) item.procedure.forEach((step) => parts.push(docxBullet(step)));
      else parts.push(docxParagraph(item.procedure));
      parts.push(docxParagraph("변형 방법", { bold: true }));
      if (Array.isArray(item.variation)) item.variation.forEach((variation) => parts.push(docxBullet(variation)));
      else parts.push(docxParagraph(item.variation));
      if (item.teacherGuide) parts.push(docxParagraph(`교사용 안내: ${item.teacherGuide}`));
      parts.push(docxParagraph("AI 붙여넣기용 프롬프트", { bold: true }));
      parts.push(docxParagraph(item.aiPrompt));
    });
  }

  if (sel.tips) {
    parts.push(docxParagraph("교사용 활용 팁", { heading: true }));
    parts.push(docxParagraph(`도입: ${content.teacherTips?.intro || ""}`));
    parts.push(docxParagraph(`전개: ${content.teacherTips?.development || ""}`));
    parts.push(docxParagraph(`정리: ${content.teacherTips?.wrapUp || ""}`));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${parts.join("")}
        <w:sectPr>
          <w:pgSz w:w="11906" w:h="16838" />
          <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" />
        </w:sectPr>
      </w:body>
    </w:document>`;
  // 워드에는 MathJax가 없으므로 LaTeX를 유니코드로 변환해 깨짐을 막는다.
  return mathToUnicode(xml);
}

function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function u16(value: number) {
  return [value & 255, (value >>> 8) & 255];
}

function u32(value: number) {
  return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
}

function concatArrays(chunks: Uint8Array[]) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
}

function createZip(files: Record<string, string>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  Object.entries(files).forEach(([name, text]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const crc = crc32(data);
    const localHeader = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0)
    ]);
    localParts.push(localHeader, nameBytes, data);

    const centralHeader = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset)
    ]);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
  });

  const central = concatArrays(centralParts);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(Object.keys(files).length), ...u16(Object.keys(files).length),
    ...u32(central.length), ...u32(offset), ...u16(0)
  ]);

  return concatArrays([...localParts, central, end]);
}

function createDocxBlob(content: GeneratedContent, sel: SectionSel = ALL_SECTIONS, meta: ExportMeta = {}) {
  const documentXml = contentToDocxDocumentXml(content, sel, meta);
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>`,
    "word/document.xml": documentXml
  };
  return new Blob([createZip(files)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
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

// 내보내기/인쇄 시 포함할 선택 항목. 고정 항목(성취기준·단원명·개념요약)은 항상 포함된다.
type SectionSel = { check: boolean; exam: boolean; essay: boolean; game: boolean; tips: boolean };
const ALL_SECTIONS: SectionSel = { check: true, exam: true, essay: true, game: true, tips: true };
type ExportMeta = { gradeName?: string; publisherName?: string; unitTitle?: string; subunitTitle?: string };

function unitHeaderText(meta: ExportMeta) {
  const parts = [meta.gradeName, meta.publisherName, meta.unitTitle].filter(Boolean).join(" · ");
  return { title: meta.subunitTitle || "수학 수업자료", sub: parts };
}

function contentToText(content: GeneratedContent, sel: SectionSel = ALL_SECTIONS, meta: ExportMeta = {}) {
  const lines: string[] = [];
  const head = unitHeaderText(meta);
  lines.push(`# ${head.title}`);
  if (head.sub) lines.push(head.sub);

  lines.push("", "[과목별 단원별 성취기준]");
  (content.achievementStandards || []).forEach((item) => {
    lines.push(`- ${item.code} (${item.relation}): ${item.description}`);
  });

  if (content.summary?.length) {
    lines.push("", "[개념 요약]");
    content.summary.forEach((item) => lines.push(`- ${formatMathText(item)}`));
  }

  if (sel.check) {
    lines.push("", "[확인 퀴즈]");
    (content.checkQuizzes || []).forEach((item, index) => {
      lines.push(`${index + 1}. ${formatMathText(item.question)}`);
      lines.push(`난이도: ${item.difficulty}`);
      lines.push(`유형: ${item.type}`);
      if (item.choices?.length) lines.push(`선택지: ${item.choices.map(formatMathText).join(" / ")}`);
      lines.push(`정답: ${formatMathText(item.answer)}`);
      if (item.explanation) lines.push(`해설: ${formatMathText(item.explanation)}`);
    });
  }

  if (sel.exam) {
    lines.push("", "[시험대비문항]");
    (content.examQuestions || []).forEach((item, index) => {
      lines.push(`${index + 1}. ${formatMathText(item.question)}`);
      if (item.difficulty) lines.push(`난이도: ${item.difficulty}`);
      if (item.choices?.length) item.choices.forEach((choice, ci) => lines.push(choiceLabel(choice, ci)));
      lines.push(`정답: ${formatMathText(item.answer)}`);
      lines.push(`풀이 과정: ${formatMathText(item.solution)}`);
    });
  }

  if (sel.essay) {
    lines.push("", "[논술형 평가 문항]");
    if (content.essayMarkdown) {
      lines.push(content.essayMarkdown);
    } else {
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
    }
  }

  if (sel.game) {
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
  }

  if (sel.tips) {
    lines.push("", "[교사용 활용 팁]");
    lines.push(`도입: ${content.teacherTips?.intro || ""}`);
    lines.push(`전개: ${content.teacherTips?.development || ""}`);
    lines.push(`정리: ${content.teacherTips?.wrapUp || ""}`);
  }

  return mathToUnicode(lines.join("\n"));
}

function contentToWordHtml(content: GeneratedContent, sel: SectionSel = ALL_SECTIONS, meta: ExportMeta = {}, opts: { includeMathJax?: boolean } = {}) {
  const head = unitHeaderText(meta);
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

  const html = `
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
        ${opts.includeMathJax ? `<script>window.MathJax={tex:{inlineMath:[['$','$']],displayMath:[['$$','$$'],['\\\\[','\\\\]']]},svg:{fontCache:'global'}};</script><script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>` : ""}
      </head>
      <body>
        <h1>${escapeHtml(head.title)}</h1>
        ${head.sub ? `<p style="color:#555;margin-top:-6px">${escapeHtml(head.sub)}</p>` : ""}

        <h2>과목별 단원별 성취기준</h2>
        ${(content.achievementStandards || []).map((item) => `<p><strong>${escapeHtml(item.code)}</strong> ${escapeHtml(item.description)} (${escapeHtml(item.relation)})</p>`).join("")}

        ${content.summary?.length ? `<h2>개념 요약</h2><ul>${listItems(content.summary)}</ul>` : ""}

        ${sel.check ? `<h2>확인 퀴즈</h2>
        ${(content.checkQuizzes || []).map((item, index) => `
          <div class="box">
            ${questionTitleHtml(index, item.question)}
            <p>난이도: ${escapeHtml(item.difficulty)} / 유형: ${escapeHtml(item.type)}</p>
            ${item.choices?.length ? `<p>선택지: ${item.choices.map(escapeHtml).join(" / ")}</p>` : ""}
            <p>정답: ${escapeHtml(item.answer)}</p>
            ${item.explanation ? `<p>해설: ${escapeHtml(item.explanation)}</p>` : ""}
          </div>
        `).join("")}` : ""}

        ${sel.exam ? `<h2>시험대비문항</h2>
        ${(content.examQuestions || []).map((item, index) => `
          <div class="box">
            ${questionTitleHtml(index, item.question)}
            ${item.difficulty ? `<p>난이도: ${escapeHtml(item.difficulty)}</p>` : ""}
            ${item.choices?.length ? item.choices.map((choice, ci) => `<p>${escapeHtml(choiceLabel(choice, ci))}</p>`).join("") : ""}
            <p>정답: ${escapeHtml(item.answer)}</p>
            <p>풀이 과정: ${escapeHtml(item.solution)}</p>
          </div>
        `).join("")}` : ""}

        ${sel.essay ? `<h2>논술형 평가 문항</h2>
        ${content.essayMarkdown
          ? `<div class="markdown-body">${renderMarkdownToHtml(content.essayMarkdown)}</div>`
          : `${essayHtml}
        <h3>논술형 채점 루브릭</h3>
        <p><strong>평가 영역명</strong>: ${escapeHtml(rubric.assessmentAreaName || "")}</p>
        <p><strong>영역 만점</strong>: ${escapeHtml(rubric.totalScore || "")}점</p>
        ${rubricHtml}`}` : ""}

        ${sel.game ? `<h2>게임 활동</h2>
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
        `).join("")}` : ""}

        ${sel.tips ? `<h2>교사용 활용 팁</h2>
        <p><strong>도입</strong>: ${escapeHtml(content.teacherTips?.intro || "")}</p>
        <p><strong>전개</strong>: ${escapeHtml(content.teacherTips?.development || "")}</p>
        <p><strong>정리</strong>: ${escapeHtml(content.teacherTips?.wrapUp || "")}</p>` : ""}
      </body>
    </html>
  `;
  // 인쇄(MathJax 포함)는 LaTeX 유지, 워드/한글용 복사는 유니코드로 변환.
  return opts.includeMathJax ? html : mathToUnicode(html);
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
  onGenerateSection,
  readOnly = false
}: {
  content: GeneratedContent;
  focusedGenerating: "" | "exam" | "essay" | "game" | "all";
  onGenerateSection: (section: "exam" | "essay" | "game") => void;
  readOnly?: boolean;
}) {
  const hasAnyContent = Boolean(
    content.achievementStandards?.length ||
    content.summary?.length ||
    content.checkQuizzes?.length ||
    content.examQuestions?.length ||
    content.essayQuestions?.length ||
    content.essayMarkdown ||
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
            <QuestionTitle index={index} text={item.question} />
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
            {!readOnly ? <p className="muted">학교 시험형 문항만 깊게 새로 개발할 수 있습니다.</p> : null}
          </div>
          {!readOnly ? (
            <button className="secondary-button" type="button" onClick={() => onGenerateSection("exam")} disabled={focusedGenerating !== ""}>
              {focusedGenerating === "exam" ? "생성중..." : "시험대비문항 새로 개발"}
            </button>
          ) : null}
        </div>
        {(content.examQuestions || []).map((item, index) => (
          <div className="question-card" key={`${item.question}-${index}`}>
            <QuestionTitle index={index} text={item.question} />
            {item.difficulty ? <p>난이도: {item.difficulty}</p> : null}
            {item.choices?.length ? (
              <div className="choice-list" style={{ margin: "6px 0" }}>
                {item.choices.map((choice, ci) => <p key={ci} style={{ margin: "2px 0" }}>{choiceLabel(choice, ci)}</p>)}
              </div>
            ) : null}
            <p>정답: <Text>{item.answer}</Text></p>
            <p>풀이 과정: <Text>{item.solution}</Text></p>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>논술형 평가 문항</h3>
            {!readOnly ? <p className="muted">실전 평가문항지(상황·제시문·소문항·모범답안·채점기준표)를 새로 개발합니다.</p> : null}
          </div>
          {!readOnly ? (
            <button className="secondary-button" type="button" onClick={() => onGenerateSection("essay")} disabled={focusedGenerating !== ""}>
              {focusedGenerating === "essay" ? "생성중..." : "고품질 논술형 새로 개발"}
            </button>
          ) : null}
        </div>
        {content.essayMarkdown ? (
          <MarkdownBody md={content.essayMarkdown} />
        ) : (
          <>
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
            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: "8px 0" }}>논술형 채점 루브릭</h4>
              <RubricView rubric={content.rubric} />
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>게임 활동</h3>
            {!readOnly ? <p className="muted">수업 활동과 바이브코딩용 한글 프롬프트를 새로 개발합니다.</p> : null}
          </div>
          {!readOnly ? (
            <button className="secondary-button" type="button" onClick={() => onGenerateSection("game")} disabled={focusedGenerating !== ""}>
              {focusedGenerating === "game" ? "생성중..." : "수업 게임활동 새로 개발"}
            </button>
          ) : null}
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
            <pre className="prompt-box">{mathToUnicode(formatMathText(item.aiPrompt))}</pre>
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

// 기존 문항 분석 전용 뷰: 소단원 구조(개념요약/게임/팁 등) 없이 '파악한 성취기준 + 유사 문항'만 표시.
function ReferenceResultView({ content }: { content: GeneratedContent }) {
  const problems = content.examQuestions || [];
  return (
    <div className="stack-sm">
      {content.achievementStandards?.length ? (
        <div className="question-card">
          <strong>파악한 성취기준</strong>
          {content.achievementStandards.map((item) => (
            <p key={`${item.code}-${item.description}`}><strong>{item.code}</strong> <Text>{item.description}</Text></p>
          ))}
        </div>
      ) : null}

      {problems.length === 0 ? (
        <p className="notice notice-error">생성된 유사 문항이 없습니다. 다시 시도해 주세요.</p>
      ) : (
        problems.map((item, index) => (
          <div className="question-card" key={`${item.question}-${index}`}>
            <QuestionTitle index={index} text={item.question} />
            {item.difficulty ? <span className="badge" style={{ marginLeft: 8 }}>{item.difficulty}</span> : null}
            {item.choices?.length ? (
              <div className="choice-list" style={{ margin: "6px 0" }}>
                {item.choices.map((choice, ci) => <p key={ci} style={{ margin: "2px 0" }}>{choiceLabel(choice, ci)}</p>)}
              </div>
            ) : null}
            <p>정답: <Text>{item.answer}</Text></p>
            {item.solution ? <p>풀이: <Text>{item.solution}</Text></p> : null}
          </div>
        ))
      )}
    </div>
  );
}

// 이미지를 최대 변 길이 maxDim 이하로 축소해 JPEG data URL로 변환한다.
// Vercel 요청 본문 한도와 토큰 비용을 줄이기 위해 클라이언트에서 미리 압축한다.
function downscaleImageToDataUrl(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      image.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("이미지 처리를 지원하지 않는 브라우저입니다."));
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
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
  const [targetLevel, setTargetLevel] = useState<"" | "A" | "B" | "C" | "D" | "E">("");
  const [referenceResult, setReferenceResult] = useState<GeneratedContent | null>(null);
  const [referenceText, setReferenceText] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceGenerating, setReferenceGenerating] = useState(false);
  const referenceFileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // 내보내기/인쇄/복사 시 포함할 선택 항목(고정 항목 제외). 기본 전체 선택.
  const [exportSel, setExportSel] = useState<SectionSel>({ check: true, exam: true, essay: true, game: true, tips: true });

  async function refresh() {
    const nextData = await apiRequest<BootstrapData>("/api/bootstrap");
    setData(nextData);
  }

  useEffect(() => {
    refresh().catch((error) => setNotice({ tone: "error", message: error.message }));
  }, []);

  // 생성 결과(소단원 자료 + 기존 문항 분석)의 LaTeX 수식($...$)을 MathJax로 조판한다.
  useEffect(() => {
    if (!result && !referenceResult) return;
    const w = window as unknown as {
      MathJax?: {
        typesetPromise?: (els?: unknown[]) => Promise<void>;
        typesetClear?: (els?: unknown[]) => void;
        startup?: { promise?: Promise<void> };
      };
    };
    let cancelled = false;

    // 스크립트는 한 번만 추가한다. (MathJax v3는 로드 후 비동기로 초기화됨)
    if (!document.getElementById("mathjax-cdn")) {
      (w as unknown as { MathJax: unknown }).MathJax = {
        tex: { inlineMath: [["$", "$"]], displayMath: [["$$", "$$"], ["\\[", "\\]"]] },
        svg: { fontCache: "global" },
        startup: { typeset: false }
      };
      const script = document.createElement("script");
      script.id = "mathjax-cdn";
      script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";
      script.async = true;
      document.head.appendChild(script);
    }

    const doTypeset = () => {
      if (cancelled || !w.MathJax?.typesetPromise) return;
      try {
        w.MathJax.typesetClear?.();
        w.MathJax.typesetPromise().catch(() => {});
      } catch {
        /* noop */
      }
    };

    // MathJax 초기화 완료를 기다린 뒤 조판. startup.promise가 아직 없으면 짧게 폴링.
    const run = () => {
      if (cancelled) return;
      const mj = w.MathJax;
      if (mj?.startup?.promise) {
        mj.startup.promise.then(doTypeset).catch(() => {});
      } else if (mj?.typesetPromise) {
        doTypeset();
      } else {
        window.setTimeout(run, 200);
      }
    };

    // 다단계 생성으로 result가 연달아 바뀔 때 마지막 상태에서 한 번만 조판되도록 디바운스.
    const id = window.setTimeout(run, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [result, referenceResult]);

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

  // 통일된 고품질 생성: 초안 생성 후 시험대비·논술형·게임활동을 전문 프롬프트로 재생성한다.
  // force=false면 같은 목표수준의 캐시가 있을 때 바로 불러오고, 없으면 전체 생성한다.
  // force=true면 항상 새 문항으로 다시 생성한다.
  async function generatePackage(force: boolean) {
    if (!subunitId) {
      setNotice({ tone: "error", message: "소단원을 선택해 주세요." });
      return;
    }
    const levelLabel = targetLevel ? `수준 ${targetLevel} ` : "";
    try {
      setFocusedGenerating("all");
      setNotice({ tone: "normal", message: `${levelLabel}소단원 자료를 생성하는 중입니다. 초안 후 시험대비·논술형·게임활동을 순서대로 개발합니다. (1~2분 소요)` });

      const draft = await apiRequest<{ content: GeneratedContent; cached?: boolean }>("/api/generate", {
        method: "POST",
        body: JSON.stringify({ subunitId, force, level: targetLevel })
      });

      // force=false인데 캐시가 있으면 그대로 사용(이미 완성된 고품질 자료).
      if (!force && draft.cached) {
        setResult({ content: draft.content, subunitId });
        setNotice({ tone: "normal", message: `저장된 ${levelLabel}소단원 자료를 불러왔습니다.` });
        await refresh();
        return;
      }

      let nextContent = draft.content;
      setResult({ content: nextContent, subunitId });

      const sectionNames = { exam: "시험대비문항", essay: "논술형 문항", game: "게임활동" };
      for (const section of ["exam", "essay", "game"] as const) {
        setNotice({ tone: "normal", message: `${levelLabel}${sectionNames[section]}을 개발하는 중입니다.` });
        const response = await apiRequest<{ content: GeneratedContent }>("/api/generate-section", {
          method: "POST",
          body: JSON.stringify({ subunitId, section, level: targetLevel })
        });
        nextContent = response.content;
        setResult({ content: nextContent, subunitId });
      }

      setNotice({ tone: "normal", message: `${levelLabel}소단원 자료를 생성해 저장했습니다.` });
      await refresh();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "자료 생성 실패" });
    } finally {
      setFocusedGenerating("");
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
        body: JSON.stringify({ subunitId, section, level: targetLevel })
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

  async function handleReferenceFile(file?: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const dataUrl = await downscaleImageToDataUrl(file);
      setReferenceImage(dataUrl);
      setNotice({ tone: "normal", message: "이미지를 첨부했습니다. '기존 문항으로 생성'을 누르세요." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "이미지 첨부 실패" });
    }
  }

  async function generateFromReference() {
    if (!referenceText.trim() && !referenceImage) {
      setNotice({ tone: "error", message: "분석할 기존 문항(텍스트 또는 이미지)을 입력해 주세요." });
      return;
    }
    try {
      setReferenceGenerating(true);
      setNotice({ tone: "normal", message: "기존 문항을 분석해 성취기준을 파악하고 새 문항을 생성하는 중입니다. (저장되지 않습니다.)" });
      const response = await apiRequest<{ content: GeneratedContent }>("/api/generate-reference", {
        method: "POST",
        body: JSON.stringify({ referenceText, imageDataUrl: referenceImage })
      });
      setReferenceResult(response.content);
      setNotice({ tone: "normal", message: "기존 문항 분석 결과를 아래에 생성했습니다. (소단원 자료와 별개, 저장 안 됨)" });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "기존 문항 분석 실패" });
    } finally {
      setReferenceGenerating(false);
    }
  }

  // 기존 문항 분석 결과 전용 내보내기(소단원 자료와 별개). 유사 문항(examQuestions)만 담는다.
  const refMeta: ExportMeta = { subunitTitle: "기존 문항 유사 문항" };
  const refSel: SectionSel = { check: false, exam: true, essay: false, game: false, tips: false };
  async function copyReferenceRich() {
    if (!referenceResult) return;
    const html = contentToWordHtml(referenceResult, refSel, refMeta);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([contentToText(referenceResult, refSel, refMeta)], { type: "text/plain" })
        })
      ]);
      setNotice({ tone: "normal", message: "기존 문항 분석 결과를 한글용으로 복사했습니다. 한글에 붙여넣기 하세요." });
    } catch {
      await navigator.clipboard.writeText(contentToText(referenceResult, refSel, refMeta));
      setNotice({ tone: "normal", message: "텍스트로 복사했습니다." });
    }
  }
  function exportReferenceWord() {
    if (!referenceResult) return;
    const blob = createDocxBlob(referenceResult, refSel, refMeta);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "기존문항분석.docx";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice({ tone: "normal", message: "기존 문항 분석 결과를 워드로 내보냈습니다." });
  }
  function printReference() {
    if (!referenceResult) return;
    const html = contentToWordHtml(referenceResult, refSel, refMeta, { includeMathJax: true });
    const win = window.open("", "_blank");
    if (!win) {
      setNotice({ tone: "error", message: "팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요." });
      return;
    }
    win.document.write(html);
    win.document.close();
    win.setTimeout(() => win.print(), 1200);
  }

  // 현재 결과의 단원 메타(학년·출판사·대단원·소단원명)를 구한다. 내보내기 머리말에 사용.
  function exportMeta(): ExportMeta {
    const subunit = data?.subunits.find((item) => item.id === result?.subunitId);
    const unit = data?.units.find((item) => item.id === subunit?.unitId);
    const grade = data?.grades.find((item) => item.id === unit?.gradeId);
    const publisher = data?.publishers.find((item) => item.id === unit?.publisherId);
    return {
      gradeName: grade?.name,
      publisherName: publisher?.name,
      unitTitle: unit?.title,
      subunitTitle: subunit?.title
    };
  }

  const SECTION_LABELS: Array<{ key: keyof SectionSel; label: string }> = [
    { key: "check", label: "확인 퀴즈" },
    { key: "exam", label: "시험대비문항" },
    { key: "essay", label: "논술형 평가 문항" },
    { key: "game", label: "게임 활동" },
    { key: "tips", label: "교사용 활용 팁" }
  ];

  function noSectionSelected() {
    return !exportSel.check && !exportSel.exam && !exportSel.essay && !exportSel.game && !exportSel.tips;
  }

  async function copyResult() {
    if (!result) {
      setNotice({ tone: "error", message: "복사할 결과가 없습니다." });
      return;
    }
    await navigator.clipboard.writeText(contentToText(result.content, exportSel, exportMeta()));
    setNotice({ tone: "normal", message: "선택한 항목을 텍스트로 복사했습니다." });
  }

  // 한글/구글독스용: 서식이 있는 HTML을 클립보드에 복사 → 한글 문서에 붙여넣으면 표·서식 유지.
  async function copyRichForHwp() {
    if (!result) {
      setNotice({ tone: "error", message: "복사할 결과가 없습니다." });
      return;
    }
    const html = contentToWordHtml(result.content, exportSel, exportMeta());
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([contentToText(result.content, exportSel, exportMeta())], { type: "text/plain" })
      });
      await navigator.clipboard.write([item]);
      setNotice({ tone: "normal", message: "한글용으로 복사했습니다. 한글 문서에 붙여넣기(Ctrl+V) 하세요. (수식은 $...$ 텍스트로 들어갑니다)" });
    } catch {
      await navigator.clipboard.writeText(contentToText(result.content, exportSel, exportMeta()));
      setNotice({ tone: "normal", message: "이 브라우저는 서식 복사를 지원하지 않아 텍스트로 복사했습니다." });
    }
  }

  function exportWord() {
    if (!result) {
      setNotice({ tone: "error", message: "내보낼 결과가 없습니다." });
      return;
    }
    const meta = exportMeta();
    const fileName = `${meta.subunitTitle || "수학_수업자료"}.docx`;
    const blob = createDocxBlob(result.content, exportSel, meta);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice({ tone: "normal", message: "워드(DOCX) 파일로 내보냈습니다. (한글에서도 열립니다)" });
  }

  // 선택 항목만 새 창에 띄워 MathJax로 수식 조판 후 인쇄.
  function printSelection() {
    if (!result) {
      setNotice({ tone: "error", message: "인쇄할 결과가 없습니다." });
      return;
    }
    const html = contentToWordHtml(result.content, exportSel, exportMeta(), { includeMathJax: true });
    const win = window.open("", "_blank");
    if (!win) {
      setNotice({ tone: "error", message: "팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요." });
      return;
    }
    win.document.write(html);
    win.document.close();
    // MathJax 조판이 끝날 시간을 준 뒤 인쇄.
    win.setTimeout(() => win.print(), 1200);
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
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", fontSize: 13, fontWeight: 700, color: "#475569", gap: 4 }}>
            목표 성취수준 (확인문제·시험대비·논술형 난이도)
            <select value={targetLevel} onChange={(event) => setTargetLevel(event.target.value as "" | "A" | "B" | "C" | "D" | "E")}>
              <option value="">수준 미지정 (혼합 난이도)</option>
              <option value="A">수준 A (상위)</option>
              <option value="B">수준 B</option>
              <option value="C">수준 C (중간)</option>
              <option value="D">수준 D</option>
              <option value="E">수준 E (기초)</option>
            </select>
          </label>
        </div>

        <div className="action-row" style={{ marginTop: 10 }}>
          <button className="primary-button" type="button" onClick={() => generatePackage(false)} disabled={focusedGenerating !== ""}>
            {focusedGenerating === "all" ? "생성중..." : "소단원 자료 생성"}
          </button>
          <button className="secondary-button" type="button" onClick={() => generatePackage(true)} disabled={focusedGenerating !== ""}>
            소단원 자료 다시 생성
          </button>
        </div>

        <p className={`notice ${notice.tone === "error" ? "notice-error" : ""}`}>{notice.message}</p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>기존 문항 / 이미지로 문항 생성</h3>
            <p className="muted">기존 평가 문항을 이미지나 텍스트로 넣으면 AI가 성취기준을 자동 파악해 유사·심화 문항을 만듭니다. (소단원 선택 불필요, 저장 안 됨)</p>
          </div>
          <input
            type="file"
            accept="image/*"
            ref={referenceFileRef}
            style={{ display: "none" }}
            onChange={(event) => handleReferenceFile(event.target.files?.[0])}
          />
          <button className="secondary-button" type="button" onClick={() => referenceFileRef.current?.click()} disabled={referenceGenerating}>
            이미지 첨부
          </button>
        </div>

        <textarea
          value={referenceText}
          onChange={(event) => setReferenceText(event.target.value)}
          onPaste={(event) => {
            const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith("image/"));
            if (item) handleReferenceFile(item.getAsFile());
          }}
          placeholder="기존 문항 텍스트를 입력하거나, 문항 이미지를 여기에 붙여넣기(Ctrl+V) 하세요."
          rows={4}
          style={{ width: "100%", marginTop: 8 }}
        />

        {referenceImage ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={referenceImage} alt="첨부한 기존 문항" style={{ height: 96, borderRadius: 8, border: "1px solid #d1d5db" }} />
            <button className="secondary-button" type="button" onClick={() => setReferenceImage(null)}>이미지 제거</button>
          </div>
        ) : null}

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button className="primary-button" type="button" onClick={generateFromReference} disabled={referenceGenerating || focusedGenerating !== ""}>
            {referenceGenerating ? "분석·생성중..." : "기존 문항으로 생성"}
          </button>
          {referenceResult ? (
            <button className="secondary-button" type="button" onClick={() => setReferenceResult(null)}>결과 지우기</button>
          ) : null}
          <span className="muted" style={{ fontSize: 12 }}>소단원 자료와 별개로 아래에 따로 표시됩니다. (저장 안 됨)</span>
        </div>
      </section>

      {referenceResult ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h3>기존 문항 분석 결과</h3>
              <p className="muted">위 소단원 자료와 별개입니다. 아래 버튼으로 내보내기/복사/인쇄하세요.</p>
            </div>
          </div>
          <div className="action-row" style={{ marginBottom: 10 }}>
            <button className="secondary-button" type="button" onClick={copyReferenceRich}>한글용 복사</button>
            <button className="secondary-button" type="button" onClick={exportReferenceWord}>워드(DOCX)로 내보내기</button>
            <button className="secondary-button" type="button" onClick={printReference}>인쇄</button>
          </div>
          <ReferenceResultView content={referenceResult} />
        </section>
      ) : null}

      {result ? (
        <section className="panel">
          <h3>내보내기 / 인쇄</h3>
          <p className="muted">성취기준 · 대단원/소단원명 · 개념 요약은 항상 포함됩니다. 아래에서 함께 담을 항목을 고르세요.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", margin: "10px 0" }}>
            {SECTION_LABELS.map(({ key, label }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={exportSel[key]}
                  onChange={(event) => setExportSel((prev) => ({ ...prev, [key]: event.target.checked }))}
                />
                {label}
              </label>
            ))}
            <button
              type="button"
              className="secondary-button"
              style={{ padding: "4px 10px", fontSize: 13 }}
              onClick={() => {
                const allOn = exportSel.check && exportSel.exam && exportSel.essay && exportSel.game && exportSel.tips;
                const next = !allOn;
                setExportSel({ check: next, exam: next, essay: next, game: next, tips: next });
              }}
            >
              {exportSel.check && exportSel.exam && exportSel.essay && exportSel.game && exportSel.tips ? "전체 해제" : "전체 선택"}
            </button>
          </div>
          <div className="action-row">
            <button className="secondary-button" type="button" onClick={copyRichForHwp} disabled={noSectionSelected()}>한글용 복사</button>
            <button className="secondary-button" type="button" onClick={exportWord} disabled={noSectionSelected()}>워드(DOCX)로 내보내기</button>
            <button className="secondary-button" type="button" onClick={copyResult} disabled={noSectionSelected()}>텍스트 복사</button>
            <button className="secondary-button" type="button" onClick={printSelection} disabled={noSectionSelected()}>인쇄</button>
          </div>
          {noSectionSelected() ? <p className="notice notice-error" style={{ marginTop: 8 }}>한 항목 이상 선택하세요.</p> : null}
        </section>
      ) : null}

      <div ref={resultRef}>
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
    </div>
  );
}
