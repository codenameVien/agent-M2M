import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "agent-M2M",
  description: "AI 구매 에이전트가 벤치마크 표로 모델을 고르고 AEGIS 토큰으로 결제하는 데모",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="site">
          <div className="inner">
            <span className="brand">agent-M2M</span>
            <nav>
              <Link href="/">새 요청</Link>
              <Link href="/purchases">구매 기록</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
