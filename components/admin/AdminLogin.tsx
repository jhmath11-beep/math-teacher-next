"use client";

import { useEffect, useState } from "react";

type AdminLoginProps = {
  children: React.ReactNode;
};

export function AdminLogin({ children }: AdminLoginProps) {
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [notice, setNotice] = useState("관리자 기능을 사용하려면 로그인해 주세요.");

  async function refreshStatus() {
    const response = await fetch("/api/admin-status");
    const data = await response.json();
    setIsAdmin(Boolean(data.isAdmin));
    setNotice(data.isAdmin ? "관리자 로그인 상태입니다." : "관리자 기능을 사용하려면 로그인해 주세요.");
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.error || "로그인에 실패했습니다.");
      return;
    }
    setPassword("");
    setIsAdmin(true);
    setNotice("로그인했습니다. 관리자 기능을 사용할 수 있습니다.");
  }

  async function logout() {
    await fetch("/api/admin-logout", { method: "POST" });
    setIsAdmin(false);
    setNotice("로그아웃했습니다.");
  }

  return (
    <div className="stack">
      <form className="panel" onSubmit={login}>
        <h3>관리자 로그인</h3>
        <label>
          관리자 비밀번호
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="기본값: admin1234"
          />
        </label>
        <div className="action-row">
          <button className="primary-button" type="submit">로그인</button>
          <button className="secondary-button" type="button" onClick={logout}>로그아웃</button>
        </div>
        <p className="notice">{notice}</p>
      </form>
      {isAdmin ? children : null}
    </div>
  );
}
