import Link from "next/link";

import { PurchaseTable } from "@/components/PurchaseTable";
import { auditPurchase, SEVERITY_LABEL, SEVERITY_TONE } from "@/lib/audit";
import { aegisText } from "@/lib/format";
import { buyerBalance } from "@/lib/payment";
import { listPurchases } from "@/lib/store";

export const dynamic = "force-dynamic";

// 화면 구성은 PBL-aegis 감사 대시보드의 개요 화면(요약 4칸 + 최근 기록 + 감사 경고)을 따른다.

/** 첫 화면 표에 보여줄 최근 기록 수. 나머지는 전체 기록 화면에서 본다. */
const RECENT_COUNT = 6;

export default async function DashboardPage() {
  const [records, balance] = await Promise.all([listPurchases(), buyerBalance()]);
  const alerts = records.flatMap((record) => auditPurchase(record).map((finding) => ({ record, finding })));
  const risk = alerts.filter(({ finding }) => finding.severity === "RISK").length;
  const caution = alerts.length - risk;
  const settled = records.filter((record) => record.status === "SETTLED");
  const spentUnits = settled.reduce((sum, record) => sum + record.decision.winner.amountUnits, 0);

  return (
    <div className="auditMain">
      <section className="auditMetrics" aria-label="구매 요약">
        <article>
          <span>구매 에이전트 토큰 잔액</span>
          <strong>{balance.units === null ? "—" : aegisText(balance.units)}</strong>
          {balance.units === null && <small>{balance.status}</small>}
        </article>
        <article>
          <span>정산 완료 거래</span>
          <strong>{settled.length}</strong>
          <small>전체 요청 {records.length}건 중</small>
        </article>
        <article>
          <span>결제 금액 합계</span>
          <strong>{aegisText(spentUnits)}</strong>
          <small>정산 완료 거래 기준</small>
        </article>
        <article>
          <span>열린 경고</span>
          <strong className={risk > 0 ? "riskText" : ""}>
            {risk} 위험 <b>·</b> {caution} 주의
          </strong>
        </article>
      </section>

      <section className="auditLayout">
        <div className="auditPrimary">
          <article className="panel">
            <div className="sectionHead">
              <div>
                <p className="eyebrow">RECENT TRANSACTIONS</p>
                <h2>최근 요청·결제 기록</h2>
              </div>
              <Link href="/dashboard/purchases">전체 기록 →</Link>
            </div>
            <PurchaseTable records={records.slice(0, RECENT_COUNT)} />
          </article>
        </div>

        <aside className="auditSidebar">
          <article className="panel">
            <div className="sectionHead">
              <div>
                <p className="eyebrow">AUDIT ALERTS</p>
                <h2>확인이 필요한 항목</h2>
              </div>
              <Link href="/dashboard/alerts">전체 →</Link>
            </div>
            {alerts.length === 0 ? (
              <div className="clearState">
                <span>✓</span>
                <div>
                  <strong>열린 경고 없음</strong>
                        </div>
              </div>
            ) : (
              <div className="compactAlerts">
                {alerts.slice(0, 4).map(({ record, finding }) => (
                  <div key={`${record.id}-${finding.code}`}>
                    <span className={`badge ${SEVERITY_TONE[finding.severity]}`}>{SEVERITY_LABEL[finding.severity]}</span>
                    <span>
                      <Link href={`/dashboard/${record.id}`}>{finding.title}</Link>
                      <small>{finding.code}</small>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </aside>
      </section>
    </div>
  );
}
