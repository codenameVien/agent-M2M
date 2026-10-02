import Link from "next/link";

import { auditPurchase, SEVERITY_LABEL, SEVERITY_TONE } from "@/lib/audit";
import { listPurchases } from "@/lib/store";

export const dynamic = "force-dynamic";

// PBL-aegis 감사 대시보드의 "감사 경고" 화면과 같은 구성.
export default async function AlertsPage() {
  const records = await listPurchases();
  const alerts = records.flatMap((record) => auditPurchase(record).map((finding) => ({ record, finding })));

  return (
    <>
      <div className="pageHead">
        <p className="eyebrow">감사 경고</p>
        <h1>확인이 필요한 위험 요소</h1>
        <p>저장된 구매 기록을 고정 규칙으로 다시 확인한 결과입니다. 기록은 고치지 않고 볼 때마다 계산합니다.</p>
      </div>
      <section className="alertList">
        {alerts.length === 0 ? (
          <p className="empty">현재 열린 주의·위험 경고가 없습니다.</p>
        ) : (
          alerts.map(({ record, finding }) => (
            <article className="panel alert" key={`${record.id}-${finding.code}`}>
              <span className={`badge ${SEVERITY_TONE[finding.severity]}`}>{SEVERITY_LABEL[finding.severity]}</span>
              <div>
                <h2>{finding.title}</h2>
                <p>{finding.detail}</p>
                <small>
                  {finding.code} · 요청 &ldquo;{record.prompt}&rdquo;
                </small>
              </div>
              <Link href={`/dashboard/${record.id}`}>거래 보기 →</Link>
            </article>
          ))
        )}
      </section>
    </>
  );
}
