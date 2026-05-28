import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default function AdminPage() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">관리자</p>
          <h1>자료 관리</h1>
          <p className="sidebar-copy">
            단원 구조, PDF, 성취기준, 생성 결과를 관리합니다.
          </p>
        </div>
      </aside>
      <main className="stack">
        <div className="page-heading">
          <p className="eyebrow">관리자 화면</p>
          <h2>단원 등록 및 PDF 관리</h2>
        </div>
        <AdminLogin>
          <AdminDashboard />
        </AdminLogin>
      </main>
    </div>
  );
}
