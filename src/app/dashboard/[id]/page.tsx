import { notFound } from "next/navigation";

import { CandidateTables, PurchaseSummary } from "@/components/DecisionView";
import { auditPurchase, combineSeverity, SEVERITY_LABEL, SEVERITY_TONE } from "@/lib/audit";
import { getPurchase } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getPurchase(id);
  if (record === null) notFound();
  const findings = auditPurchase(record);
  const severity = combineSeverity(findings);

  return (
    <>
      <h1>구매 상세</h1>
      <p className="muted">
        구매 번호 <code>{record.id}</code> · {new Date(record.createdAt).toLocaleString("ko-KR", { hour12: false })}
      </p>

      <h2>요청 내용</h2>
      <pre className="result">{record.prompt}</pre>

      <h2>
        감사 결과 <span className={`badge ${SEVERITY_TONE[severity]}`}>{SEVERITY_LABEL[severity]}</span>
      </h2>
      {findings.length === 0 ? (
        <p className="muted">고정 규칙 검사에서 걸린 항목이 없습니다.</p>
      ) : (
        findings.map((finding) => (
          <div className={`finding ${finding.severity === "RISK" ? "risk" : "caution"}`} key={finding.code}>
            <strong>{finding.title}</strong>
            <p>{finding.detail}</p>
            <small className="muted">{finding.code}</small>
          </div>
        ))
      )}

      <h2>요약</h2>
      <PurchaseSummary record={record} />
      <CandidateTables record={record} />
    </>
  );
}
