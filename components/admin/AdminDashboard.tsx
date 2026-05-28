"use client";

import { useEffect, useMemo, useState } from "react";
import type { BootstrapData } from "@/types/database";

type Notice = {
  tone: "normal" | "error";
  message: string;
};

type PdfPage = {
  pageNumber: number;
  text: string;
};

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({ error: "서버 응답을 읽지 못했습니다." }));
  if (!response.ok) throw new Error(data.error || "요청에 실패했습니다.");
  return data as T;
}

async function extractPdfPages(file: File): Promise<PdfPage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages: PdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    pages.push({
      pageNumber,
      text: textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    });
  }

  return pages;
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  new Uint8Array(buffer).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function AdminDashboard() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [notice, setNotice] = useState<Notice>({ tone: "normal", message: "" });
  const [unitForm, setUnitForm] = useState({
    gradeName: "중2",
    publisherName: "공통",
    unitTitle: "",
    subunitTitle: ""
  });
  const [selectedSubunitId, setSelectedSubunitId] = useState("");
  const [standardSubunitId, setStandardSubunitId] = useState("");
  const [achievementStandard, setAchievementStandard] = useState("");
  const [subunitText, setSubunitText] = useState("");
  const [fullPdfPages, setFullPdfPages] = useState<PdfPage[]>([]);
  const [fullPdfFileName, setFullPdfFileName] = useState("");
  const [rangeSubunitId, setRangeSubunitId] = useState("");
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(1);
  const [rangePreview, setRangePreview] = useState("");

  const subunitOptions = useMemo(() => {
    if (!data) return [];
    return data.subunits.map((subunit) => {
      const unit = data.units.find((item) => item.id === subunit.unitId);
      const grade = data.grades.find((item) => item.id === unit?.gradeId);
      const publisher = data.publishers.find((item) => item.id === unit?.publisherId);
      return {
        id: subunit.id,
        label: `${grade?.name || ""} · ${publisher?.name || ""} · ${unit?.title || ""} · ${subunit.title}`,
        subunit
      };
    });
  }, [data]);

  async function refresh() {
    const nextData = await apiRequest<BootstrapData>("/api/bootstrap");
    setData(nextData);
  }

  useEffect(() => {
    refresh().catch((error) => {
      setNotice({ tone: "error", message: error.message });
    });
  }, []);

  useEffect(() => {
    if (!data || !selectedSubunitId) {
      setSubunitText("");
      return;
    }
    setSubunitText(data.pdfTexts[selectedSubunitId]?.text || "");
  }, [data, selectedSubunitId]);

  useEffect(() => {
    if (!data || !standardSubunitId) {
      setAchievementStandard("");
      return;
    }
    const subunit = data.subunits.find((item) => item.id === standardSubunitId);
    setAchievementStandard(subunit?.achievementStandard || "");
  }, [data, standardSubunitId]);

  function pageRangeText() {
    if (!fullPdfPages.length) throw new Error("먼저 전체 PDF를 추출해 주세요.");
    if (rangeStart < 1 || rangeEnd < rangeStart || rangeEnd > fullPdfPages.length) {
      throw new Error(`페이지 범위는 1부터 ${fullPdfPages.length} 사이로 지정해 주세요.`);
    }
    return fullPdfPages
      .filter((page) => page.pageNumber >= rangeStart && page.pageNumber <= rangeEnd)
      .map((page) => `[p.${page.pageNumber}]\n${page.text}`)
      .join("\n\n")
      .trim();
  }

  async function createSubunit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiRequest("/api/subunits", {
        method: "POST",
        body: JSON.stringify(unitForm)
      });
      setUnitForm((prev) => ({ ...prev, unitTitle: "", subunitTitle: "" }));
      await refresh();
      setNotice({ tone: "normal", message: "소단원을 저장했습니다." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "저장 실패" });
    }
  }

  async function uploadSubunitPdf(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = (event.currentTarget.elements.namedItem("pdfFile") as HTMLInputElement).files?.[0];
    if (!selectedSubunitId || !file) {
      setNotice({ tone: "error", message: "소단원과 PDF를 선택해 주세요." });
      return;
    }

    try {
      setNotice({ tone: "normal", message: "PDF 텍스트를 추출하고 저장하는 중입니다." });
      const text = (await extractPdfPages(file)).map((page) => `[p.${page.pageNumber}]\n${page.text}`).join("\n\n");
      await apiRequest("/api/subunit-text", {
        method: "POST",
        body: JSON.stringify({
          subunitId: selectedSubunitId,
          fileName: file.name,
          extractedText: text,
          pdfBase64: await fileToBase64(file)
        })
      });
      await refresh();
      setNotice({ tone: "normal", message: "PDF와 추출 텍스트를 저장했습니다." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "PDF 저장 실패" });
    }
  }

  async function saveManualText() {
    if (!selectedSubunitId) return;
    try {
      await apiRequest("/api/subunit-text", {
        method: "POST",
        body: JSON.stringify({
          subunitId: selectedSubunitId,
          fileName: data?.pdfTexts[selectedSubunitId]?.fileName || "",
          extractedText: subunitText
        })
      });
      await refresh();
      setNotice({ tone: "normal", message: "소단원 텍스트를 저장했습니다." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "텍스트 저장 실패" });
    }
  }

  async function saveStandard() {
    if (!standardSubunitId) return;
    try {
      await apiRequest("/api/subunit-standard", {
        method: "POST",
        body: JSON.stringify({
          subunitId: standardSubunitId,
          achievementStandard
        })
      });
      await refresh();
      setNotice({ tone: "normal", message: "성취기준을 저장했습니다." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "성취기준 저장 실패" });
    }
  }

  async function extractFullPdf(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setNotice({ tone: "normal", message: "전체 PDF를 페이지별로 추출하는 중입니다." });
      const pages = await extractPdfPages(file);
      setFullPdfPages(pages);
      setFullPdfFileName(file.name);
      setRangeStart(1);
      setRangeEnd(Math.min(1, pages.length));
      setRangePreview(pages.slice(0, 2).map((page) => `[p.${page.pageNumber}]\n${page.text}`).join("\n\n"));
      setNotice({ tone: "normal", message: `${pages.length}쪽을 추출했습니다.` });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "전체 PDF 추출 실패" });
    }
  }

  async function saveRangeText() {
    if (!rangeSubunitId) return;
    try {
      const text = pageRangeText();
      await apiRequest("/api/subunit-text", {
        method: "POST",
        body: JSON.stringify({
          subunitId: rangeSubunitId,
          fileName: `${fullPdfFileName} p.${rangeStart}-${rangeEnd}`,
          extractedText: text
        })
      });
      await refresh();
      setNotice({ tone: "normal", message: "선택한 페이지 범위를 소단원 텍스트로 저장했습니다." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "범위 저장 실패" });
    }
  }

  return (
    <div className="stack">
      {notice.message ? (
        <p className={`notice ${notice.tone === "error" ? "notice-error" : ""}`}>{notice.message}</p>
      ) : null}

      <section className="panel">
        <h3>단원 정보 등록</h3>
        <form className="grid-4" onSubmit={createSubunit}>
          <label>
            학년
            <input value={unitForm.gradeName} onChange={(event) => setUnitForm({ ...unitForm, gradeName: event.target.value })} />
          </label>
          <label>
            출판사
            <input value={unitForm.publisherName} onChange={(event) => setUnitForm({ ...unitForm, publisherName: event.target.value })} />
          </label>
          <label>
            대단원
            <input value={unitForm.unitTitle} onChange={(event) => setUnitForm({ ...unitForm, unitTitle: event.target.value })} />
          </label>
          <label>
            소단원
            <input value={unitForm.subunitTitle} onChange={(event) => setUnitForm({ ...unitForm, subunitTitle: event.target.value })} />
          </label>
          <button className="primary-button" type="submit">소단원 저장</button>
        </form>
      </section>

      <section className="panel">
        <h3>소단원별 PDF 업로드</h3>
        <form className="grid-2" onSubmit={uploadSubunitPdf}>
          <label>
            소단원
            <select value={selectedSubunitId} onChange={(event) => setSelectedSubunitId(event.target.value)}>
              <option value="">소단원 선택</option>
              {subunitOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label>
            PDF 파일
            <input name="pdfFile" type="file" accept="application/pdf" />
          </label>
          <button className="primary-button" type="submit">PDF 추출 후 저장</button>
        </form>
      </section>

      <section className="panel">
        <h3>소단원 성취기준 연결</h3>
        <select value={standardSubunitId} onChange={(event) => setStandardSubunitId(event.target.value)}>
          <option value="">소단원 선택</option>
          {subunitOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <textarea value={achievementStandard} onChange={(event) => setAchievementStandard(event.target.value)} />
        <button className="secondary-button" type="button" onClick={saveStandard}>성취기준 저장</button>
      </section>

      <section className="panel">
        <h3>전체 교과서 PDF에서 소단원 텍스트 나누기</h3>
        <input type="file" accept="application/pdf" onChange={extractFullPdf} />
        <div className="grid-4">
          <label>
            저장할 소단원
            <select value={rangeSubunitId} onChange={(event) => setRangeSubunitId(event.target.value)}>
              <option value="">소단원 선택</option>
              {subunitOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label>
            시작 페이지
            <input type="number" min={1} max={fullPdfPages.length || 1} value={rangeStart} onChange={(event) => setRangeStart(Number(event.target.value))} />
          </label>
          <label>
            끝 페이지
            <input type="number" min={1} max={fullPdfPages.length || 1} value={rangeEnd} onChange={(event) => setRangeEnd(Number(event.target.value))} />
          </label>
          <button className="secondary-button" type="button" onClick={() => setRangePreview(pageRangeText())}>범위 미리보기</button>
          <button className="primary-button" type="button" onClick={saveRangeText}>범위 저장</button>
        </div>
        <textarea value={rangePreview} onChange={(event) => setRangePreview(event.target.value)} />
      </section>

      <section className="panel">
        <h3>소단원 DB에 저장된 텍스트</h3>
        <textarea value={subunitText} onChange={(event) => setSubunitText(event.target.value)} />
        <button className="secondary-button" type="button" onClick={saveManualText}>소단원 텍스트 다시 저장</button>
      </section>
    </div>
  );
}
