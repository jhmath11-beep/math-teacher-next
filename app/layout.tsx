import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "수학교과 통합 웹앱",
  description: "중학교 수학 교사용 소단원 자료 생성 웹앱"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
