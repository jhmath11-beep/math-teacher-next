import Link from "next/link";
import { TeacherDashboard } from "@/components/teacher/TeacherDashboard";

export default function HomePage() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">교사용</p>
          <h1>수학교과 통합 웹앱</h1>
          <p className="sidebar-copy">
            학년, 출판사, 대단원, 소단원을 선택해 수업 자료를 생성하고 확인합니다.
          </p>
        </div>
        <nav className="nav-list" aria-label="관리 메뉴">
          <Link className="nav-link" href="/admin">관리자 화면</Link>
        </nav>
      </aside>
      <main className="stack">
        <div className="page-heading">
          <p className="eyebrow">교사용 화면</p>
          <h2>AI 수업 자료 생성</h2>
        </div>
        <TeacherDashboard />
      </main>
    </div>
  );
}
