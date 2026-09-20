import Link from "next/link";

import { toAegis } from "@/lib/format";
import { listPurchases } from "@/lib/store";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { hour12: false });
}

export default function PurchasesPage() {
  const records = listPurchases();
  return (
    <>
      <h1>구매 기록</h1>
      <p className="muted">최근 {records.length}건. 한 번 저장된 기록은 고치지 않습니다.</p>
      {records.length === 0 ? (
        <p>아직 기록이 없습니다. <Link href="/">새 요청</Link>을 보내 보세요.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>시각</th>
                <th>선택된 모델</th>
                <th className="num">금액 (AEGIS)</th>
                <th>우선순위</th>
                <th>상태</th>
                <th>모드</th>
                <th>거래번호</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{when(record.createdAt)}</td>
                  <td>{record.decision.winner.displayName}</td>
                  <td className="num">{toAegis(record.decision.winner.amountUnits)}</td>
                  <td>{record.decision.priority}</td>
                  <td>
                    <span className={`status-${record.status}`}>{record.status}</span>
                  </td>
                  <td>{record.payment?.mode ?? "-"}</td>
                  <td>
                    <code className="hash">{record.payment?.txHash ?? "-"}</code>
                  </td>
                  <td>
                    <Link href={`/purchases/${record.id}`}>보기</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
