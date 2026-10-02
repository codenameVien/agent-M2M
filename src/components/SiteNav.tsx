import Link from "next/link";

export function SiteNav() {
  return (
    <nav>
      <Link href="/">새 요청</Link>
      <Link href="/dashboard">대시보드</Link>
      <Link href="/dashboard/alerts">감사 경고</Link>
    </nav>
  );
}
