"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { achievementStandards, formatAchievementStandard } from "@/lib/data/achievementStandards";
import type { BootstrapData } from "@/types/database";

type Notice = {
  tone: "normal" | "error";
  message: string;
};

type PdfPage = {
  pageNumber: number;
  text: string;
};

type InventoryRow = {
  id: string;
  gradeName: string;
  publisherName: string;
  unitTitle: string;
  subunitTitle: string;
  pdfFileName: string;
  textLength: number;
  textUpdatedAt: string;
  hasAchievementStandard: boolean;
  hasGeneratedContent: boolean;
};

type PdfUploadTicket = {
  bucket: string;
  path: string;
  token: string;
};

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
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
  const [textReviewSubunitId, setTextReviewSubunitId] = useState("");
  const [subunitText, setSubunitText] = useState("");
  const [fullPdfPages, setFullPdfPages] = useState<PdfPage[]>([]);
  const [fullPdfFileName, setFullPdfFileName] = useState("");
  const [rangeSubunitId, setRangeSubunitId] = useState("");
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(1);
  const [rangePreview, setRangePreview] = useState("");
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isSavingStandard, setIsSavingStandard] = useState(false);
  const [showLinkedStandards, setShowLinkedStandards] = useState(false);
  const [pdfInputKey, setPdfInputKey] = useState(0);

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

  const inventoryRows = useMemo<InventoryRow[]>(() => {
    if (!data) return [];
    return data.subunits.map((subunit) => {
      const unit = data.units.find((item) => item.id === subunit.unitId);
      const grade = data.grades.find((item) => item.id === unit?.gradeId);
      const publisher = data.publishers.find((item) => item.id === unit?.publisherId);
      const pdfText = data.pdfTexts[subunit.id];
      const generatedContent = data.generated[subunit.id];

      return {
        id: subunit.id,
        gradeName: grade?.name || "-",
        publisherName: publisher?.name || "-",
        unitTitle: unit?.title || "-",
        subunitTitle: subunit.title,
        pdfFileName: pdfText?.fileName || "",
        textLength: pdfText?.text?.length || 0,
        textUpdatedAt: pdfText?.updatedAt || "",
        hasAchievementStandard: Boolean(subunit.achievementStandard?.trim()),
        hasGeneratedContent: Boolean(generatedContent)
      };
    });
  }, [data]);

  const inventorySummary = useMemo(() => ({
    subunitCount: inventoryRows.length,
    pdfTextCount: inventoryRows.filter((row) => row.textLength > 0).length,
    standardCount: inventoryRows.filter((row) => row.hasAchievementStandard).length,
    generatedCount: inventoryRows.filter((row) => row.hasGeneratedContent).length
  }), [inventoryRows]);

  const selectedStandardRow = useMemo(
    () => inventoryRows.find((row) => row.id === standardSubunitId),
    [inventoryRows, standardSubunitId]
  );
  const standardSubunitOptions = useMemo(
    () => subunitOptions.filter((option) => showLinkedStandards || !option.subunit.achievementStandard?.trim()),
    [showLinkedStandards, subunitOptions]
  );
  const selectedAchievementStandard = useMemo(
    () => achievementStandards.find((standard) => formatAchievementStandard(standard) === achievementStandard),
    [achievementStandard]
  );

  function formatDate(value: string) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

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
    if (!data || !textReviewSubunitId) {
      setSubunitText("");
      return;
    }
    setSubunitText(data.pdfTexts[textReviewSubunitId]?.text || "");
  }, [data, textReviewSubunitId]);

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
    if (!unitForm.gradeName.trim() || !unitForm.publisherName.trim() || !unitForm.unitTitle.trim() || !unitForm.subunitTitle.trim()) {
      setNotice({ tone: "error", message: "학년, 출판사, 대단원, 소단원을 모두 입력해 주세요." });
      return;
    }

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
      setIsUploadingPdf(true);
      setNotice({ tone: "normal", message: "업로드중... PDF 텍스트를 추출하는 중입니다." });
      const text = (await extractPdfPages(file)).map((page) => `[p.${page.pageNumber}]\n${page.text}`).join("\n\n");

      setNotice({ tone: "normal", message: "업로드중... PDF 원본을 저장하는 중입니다." });
      const uploadTicket = await apiRequest<PdfUploadTicket>("/api/pdf-upload-url", {
        method: "POST",
        body: JSON.stringify({
          subunitId: selectedSubunitId,
          fileName: file.name
        })
      });

      const { error: uploadError } = await createSupabaseBrowserClient()
        .storage
        .from(uploadTicket.bucket)
        .uploadToSignedUrl(uploadTicket.path, uploadTicket.token, file, {
          contentType: "application/pdf"
        });
      if (uploadError) throw new Error(uploadError.message);

      setNotice({ tone: "normal", message: "업로드중... 추출 텍스트를 DB에 저장하는 중입니다." });
      await apiRequest("/api/subunit-text", {
        method: "POST",
        body: JSON.stringify({
          subunitId: selectedSubunitId,
          fileName: file.name,
          extractedText: text,
          pdfFilePath: uploadTicket.path
        })
      });
      await refresh();
      setSelectedSubunitId("");
      setPdfInputKey((prev) => prev + 1);
      setNotice({ tone: "normal", message: "PDF와 추출 텍스트를 저장했습니다." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "PDF 저장 실패" });
    } finally {
      setIsUploadingPdf(false);
    }
  }

  async function saveManualText() {
    if (!textReviewSubunitId) return;
    try {
      await apiRequest("/api/subunit-text", {
        method: "POST",
        body: JSON.stringify({
          subunitId: textReviewSubunitId,
          fileName: data?.pdfTexts[textReviewSubunitId]?.fileName || "",
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
      setIsSavingStandard(true);
      setNotice({ tone: "normal", message: "업로드중... 성취기준을 저장하는 중입니다." });
      await apiRequest("/api/subunit-standard", {
        method: "POST",
        body: JSON.stringify({
          subunitId: standardSubunitId,
          achievementStandard
        })
      });
      await refresh();
      setStandardSubunitId("");
      setAchievementStandard("");
      setNotice({ tone: "normal", message: "성취기준을 저장했습니다." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "성취기준 저장 실패" });
    } finally {
      setIsSavingStandard(false);
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
        <div className="section-heading">
          <div>
            <h3>등록된 단원 목록</h3>
            <p className="muted">입력한 학년, 출판사, 대단원, 소단원을 확인하고 중복 입력을 점검합니다.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => refresh()}>목록 새로고침</button>
        </div>
        {inventoryRows.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>학년</th>
                  <th>출판사</th>
                  <th>대단원</th>
                  <th>소단원</th>
                  <th>PDF</th>
                  <th>AI 결과</th>
                </tr>
              </thead>
              <tbody>
                {inventoryRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.gradeName}</td>
                    <td>{row.publisherName}</td>
                    <td>{row.unitTitle}</td>
                    <td>{row.subunitTitle}</td>
                    <td>{row.textLength > 0 ? <span className="status-ok">텍스트 저장됨</span> : <span className="status-empty">미등록</span>}</td>
                    <td>{row.hasGeneratedContent ? <span className="status-ok">생성됨</span> : <span className="status-empty">미생성</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="notice">아직 등록된 단원이 없습니다.</p>
        )}
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
            <input key={pdfInputKey} name="pdfFile" type="file" accept="application/pdf" disabled={isUploadingPdf} />
          </label>
          <button className="primary-button" type="submit" disabled={isUploadingPdf}>
            {isUploadingPdf ? "업로드중..." : "PDF 추출 후 저장"}
          </button>
        </form>
      </section>

      <section className="panel">
        <h3>소단원 성취기준 연결</h3>
        {subunitOptions.length ? (
          <>
            <label>
              성취기준을 연결할 소단원
              <select
                value={standardSubunitId}
                onChange={(event) => setStandardSubunitId(event.target.value)}
                disabled={isSavingStandard}
              >
                <option value="">소단원 선택</option>
                {standardSubunitOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={showLinkedStandards}
                onChange={(event) => setShowLinkedStandards(event.target.checked)}
                disabled={isSavingStandard}
              />
              이미 성취기준이 연결된 소단원도 보기
            </label>
            {!standardSubunitOptions.length ? (
              <p className="notice">모든 소단원에 성취기준이 연결되어 있습니다.</p>
            ) : null}
            {selectedStandardRow ? (
              <p className="selected-path">
                선택됨: {selectedStandardRow.gradeName} / {selectedStandardRow.publisherName} / {selectedStandardRow.unitTitle} / {selectedStandardRow.subunitTitle}
              </p>
            ) : (
              <p className="muted">먼저 위 목록에서 소단원을 선택하면 기존 성취기준이 표시됩니다.</p>
            )}
            <label>
              성취기준
              <select
                value={achievementStandard}
                onChange={(event) => setAchievementStandard(event.target.value)}
                disabled={isSavingStandard}
              >
                <option value="">성취기준 선택</option>
                {achievementStandards.map((standard) => (
                  <option key={standard.code} value={formatAchievementStandard(standard)}>
                    [{standard.code}] {standard.text}
                  </option>
                ))}
              </select>
            </label>
            {selectedAchievementStandard ? (
              <p className="selected-path">
                선택한 성취기준: [{selectedAchievementStandard.code}] {selectedAchievementStandard.text}
              </p>
            ) : null}
            <button className="secondary-button" type="button" onClick={saveStandard} disabled={!standardSubunitId || !achievementStandard || isSavingStandard}>
              {isSavingStandard ? "업로드중..." : "성취기준 저장"}
            </button>
          </>
        ) : (
          <p className="notice">등록된 소단원이 없습니다. 먼저 단원 정보 등록에서 소단원을 저장해 주세요.</p>
        )}
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
        <h3>추출된 교과서 텍스트 확인/수정</h3>
        <label>
          확인할 소단원
          <select value={textReviewSubunitId} onChange={(event) => setTextReviewSubunitId(event.target.value)}>
            <option value="">소단원 선택</option>
            {subunitOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        {textReviewSubunitId ? (
          data?.pdfTexts[textReviewSubunitId]?.text ? (
            <p className="selected-path">
              저장된 텍스트: {data.pdfTexts[textReviewSubunitId].text.length.toLocaleString()}자 · {data.pdfTexts[textReviewSubunitId].fileName || "파일명 없음"}
            </p>
          ) : (
            <p className="notice">이 소단원에는 아직 저장된 PDF 추출 텍스트가 없습니다.</p>
          )
        ) : (
          <p className="muted">소단원을 선택하면 AI가 사용할 교과서 텍스트를 확인할 수 있습니다.</p>
        )}
        <textarea
          value={subunitText}
          onChange={(event) => setSubunitText(event.target.value)}
          placeholder="소단원을 선택하면 PDF에서 추출된 텍스트가 표시됩니다."
          disabled={!textReviewSubunitId}
        />
        <button className="secondary-button" type="button" onClick={saveManualText} disabled={!textReviewSubunitId}>
          수정한 텍스트 저장
        </button>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>등록 현황</h3>
            <p className="muted">저장된 소단원과 PDF 텍스트, 성취기준, AI 생성 결과를 확인합니다.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => refresh()}>새로고침</button>
        </div>

        <div className="status-grid">
          <div className="status-card">
            <span>소단원</span>
            <strong>{inventorySummary.subunitCount}</strong>
          </div>
          <div className="status-card">
            <span>PDF 텍스트</span>
            <strong>{inventorySummary.pdfTextCount}</strong>
          </div>
          <div className="status-card">
            <span>성취기준</span>
            <strong>{inventorySummary.standardCount}</strong>
          </div>
          <div className="status-card">
            <span>AI 결과</span>
            <strong>{inventorySummary.generatedCount}</strong>
          </div>
        </div>

        {inventoryRows.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>학년</th>
                  <th>출판사</th>
                  <th>대단원</th>
                  <th>소단원</th>
                  <th>PDF 텍스트</th>
                  <th>성취기준</th>
                  <th>AI 결과</th>
                  <th>업데이트</th>
                </tr>
              </thead>
              <tbody>
                {inventoryRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.gradeName}</td>
                    <td>{row.publisherName}</td>
                    <td>{row.unitTitle}</td>
                    <td>{row.subunitTitle}</td>
                    <td>
                      {row.textLength > 0 ? (
                        <span className="status-ok">{row.pdfFileName || "저장됨"} · {row.textLength.toLocaleString()}자</span>
                      ) : (
                        <span className="status-empty">미등록</span>
                      )}
                    </td>
                    <td>{row.hasAchievementStandard ? <span className="status-ok">등록</span> : <span className="status-empty">미등록</span>}</td>
                    <td>{row.hasGeneratedContent ? <span className="status-ok">생성됨</span> : <span className="status-empty">미생성</span>}</td>
                    <td>{formatDate(row.textUpdatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="notice">아직 등록된 소단원이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
