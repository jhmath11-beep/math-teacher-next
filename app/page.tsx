import Link from "next/link";

export default function HomePage() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">운영용</p>
          <h1>수학교과 통합 웹앱</h1>
          <p className="sidebar-copy">
            Supabase와 AI API를 사용하는 실제 구동용 Next.js 버전입니다.
          </p>
        </div>
        <nav className="nav-list" aria-label="주요 화면">
          <Link className="nav-link" href="/teacher">교사용 화면</Link>
          <Link className="nav-link" href="/admin">관리자 화면</Link>
        </nav>
      </aside>
      <main>
        <div className="page-heading">
          <p className="eyebrow">시작</p>
          <h2>소단원 수업 자료 생성</h2>
        </div>
        <section className="panel">
          <p>
            MVP에서 검증한 단원 관리, PDF 텍스트 추출, AI 생성, 결과 저장 기능을
            Next.js 구조로 옮기는 중입니다.
          </p>
          <div className="grid-2">
            <Link className="primary-button" href="/teacher">교사용 화면 열기</Link>
            <Link className="secondary-button" href="/admin">관리자 화면 열기</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
