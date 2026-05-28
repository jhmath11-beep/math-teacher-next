import { TeacherDashboard } from "@/components/teacher/TeacherDashboard";

export default function TeacherPage() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">교사용</p>
          <h1>소단원 자료실</h1>
          <p className="sidebar-copy">
            학년, 출판사, 대단원, 소단원을 선택해 수업 자료를 확인합니다.
          </p>
        </div>
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
