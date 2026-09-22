/**
 * 결정 결과를 보여주는 표들. 새 요청 화면과 기록 상세 화면이 같은 모양으로 보여주기 위해 공유한다.
 * 훅을 쓰지 않으므로 서버·클라이언트 어느 쪽에서도 그릴 수 있다.
 */

import { aegisText, toAegis } from "@/lib/format";
import { PRIORITY_LABEL } from "@/lib/priority-label";
import type { PurchaseRecord } from "@/lib/types";

function fmt(value: number): string {
  return value.toLocaleString("ko-KR");
}

function score(value: number): string {
  return value.toFixed(2);
}

/** 상단 요약 + 결제 + 결과. */
export function PurchaseSummary({ record }: { record: PurchaseRecord }) {
  const { decision, payment } = record;
  return (
    <>
      <table className="kv">
        <tbody>
          <tr>
            <th>상태</th>
            <td>
              <span className={`status-${record.status}`}>
                {record.status === "SETTLED" ? "완료 (SETTLED)" : "실패 (FAILED)"}
              </span>
              {record.failureReason !== null && <> — {record.failureReason}</>}
            </td>
          </tr>
          <tr>
            <th>선택된 모델</th>
            <td>
              {decision.winner.displayName} <code>{decision.winner.key}</code>
            </td>
          </tr>
          <tr>
            <th>결제 금액</th>
            <td>
              {aegisText(decision.winner.amountUnits)}
              <span className="muted"> (예산 {aegisText(decision.budgetUnits)})</span>
            </td>
          </tr>
          <tr>
            <th>우선순위 / 가중치</th>
            <td>
              {PRIORITY_LABEL[decision.priority]} — 가격 {decision.weights.price} · 속도{" "}
              {decision.weights.time} · 성능 {decision.weights.intelligence}
            </td>
          </tr>
          <tr>
            <th>토큰 추정</th>
            <td>
              입력 {fmt(decision.estimatedInputTokens)} · 최대 출력 {fmt(decision.maxOutputTokens)}
            </td>
          </tr>
          <tr>
            <th>벤치마크 스냅샷</th>
            <td>
              <code>{decision.snapshotId}</code> / 카탈로그 <code>{decision.catalogVersion}</code>
              <br />
              <code className="hash">{decision.snapshotHash}</code>
            </td>
          </tr>
          <tr>
            <th>결제 모드</th>
            <td>{payment === null ? "결제 없음" : payment.mode === "live" ? "live (실제 전송)" : "mock (전송 없음)"}</td>
          </tr>
          <tr>
            <th>거래번호 (tx)</th>
            <td>
              <code className="hash">{payment?.txHash ?? "-"}</code>
            </td>
          </tr>
          <tr>
            <th>보낸 주소 → 받은 주소</th>
            <td>
              {payment === null ? (
                "-"
              ) : (
                <>
                  <code className="hash">{payment.from}</code> → <code className="hash">{payment.to}</code>
                </>
              )}
            </td>
          </tr>
          <tr>
            <th>토큰 / 체인</th>
            <td>
              {payment === null ? (
                "-"
              ) : (
                <>
                  <code className="hash">{payment.tokenAddress}</code> · chainId {payment.chainId}
                  {payment.blockNumber !== undefined && <> · block {payment.blockNumber}</>}
                </>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <h2>결과</h2>
      {record.resultText === null ? (
        <p className="muted">결제가 확인되지 않아 결과가 없습니다.</p>
      ) : (
        <pre className="result">{record.resultText}</pre>
      )}
    </>
  );
}

/** 점수가 없는 옛 기록(두 출처 도입 전)도 깨지지 않게 보여준다. */
function maybe(value: number | undefined): string {
  return value === undefined ? "-" : score(value);
}

/** 후보 점수표 + 성능 점수 내역 + 탈락 후보표. */
export function CandidateTables({ record }: { record: PurchaseRecord }) {
  const { decision } = record;
  const sources = decision.performanceSources;
  return (
    <>
      <h2>후보 점수</h2>
      <p className="muted">
        기준값 — 최저 금액 {aegisText(decision.references.minAmountUnits)} · 최단 완료{" "}
        {fmt(decision.references.minCompletionMs)} ms. 각 점수는 100점 만점이고, 총점은 가중치(가격{" "}
        {decision.weights.price} / 속도 {decision.weights.time} / 성능 {decision.weights.intelligence})로 합친
        값입니다.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="num">순위</th>
              <th>모델</th>
              <th className="num">금액 (AEGIS)</th>
              <th className="num">완료 (ms)</th>
              <th className="num">가격 점수</th>
              <th className="num">속도 점수</th>
              <th className="num">성능 점수</th>
              <th className="num">총점</th>
            </tr>
          </thead>
          <tbody>
            {decision.candidates.map((candidate) => (
              <tr key={candidate.key} className={candidate.rank === 1 ? "winner" : undefined}>
                <td className="num">{candidate.rank}</td>
                <td>
                  {candidate.displayName}
                  <br />
                  <code>{candidate.key}</code>
                </td>
                <td className="num">{toAegis(candidate.amountUnits)}</td>
                <td className="num">{fmt(candidate.completionMs)}</td>
                <td className="num">{score(candidate.priceScore)}</td>
                <td className="num">{score(candidate.timeScore)}</td>
                <td className="num">{score(candidate.intelligenceScore)}</td>
                <td className="num">{score(candidate.totalScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>성능 점수 내역 · 두 출처</h2>
      {sources === undefined ? (
        <p className="muted">이 기록은 두 출처를 합치기 전에 만들어져 AA 지능 지수 하나로 계산했습니다.</p>
      ) : (
        <>
          <p className="muted">
            성능 점수 = ({sources.aa} 점수 + {sources.arena} 점수) ÷ 2. AA 점수는 최고 지능 지수(
            {decision.references.maxIntelligenceIndex}) 대비, Arena 점수는 1등 후보(Elo{" "}
            {decision.references.maxArenaRating})와 붙었을 때 이길 확률로 환산했습니다
            {sources.arenaPublishDate !== null && <> · Arena 발행일 {sources.arenaPublishDate}</>}.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>모델</th>
                  <th className="num">AA 지능 지수</th>
                  <th className="num">AA 점수</th>
                  <th className="num">Arena Elo</th>
                  <th className="num">Arena 점수</th>
                  <th className="num">성능 점수</th>
                  <th>비교한 노력 수준</th>
                </tr>
              </thead>
              <tbody>
                {decision.candidates.map((candidate) => (
                  <tr key={candidate.key}>
                    <td>
                      {candidate.displayName}
                      <br />
                      <code>{candidate.arenaModel ?? "-"}</code>
                    </td>
                    <td className="num">{candidate.intelligenceIndex}</td>
                    <td className="num">{maybe(candidate.aaScore)}</td>
                    <td className="num">{candidate.arenaRating === undefined ? "-" : fmt(Math.round(candidate.arenaRating))}</td>
                    <td className="num">{maybe(candidate.arenaScore)}</td>
                    <td className="num">{score(candidate.intelligenceScore)}</td>
                    <td className="muted">{candidate.effortPairing || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>탈락 후보</h2>
      {decision.rejected.length === 0 ? (
        <p className="muted">필터에서 떨어진 후보가 없습니다.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>모델</th>
                <th className="num">금액 (AEGIS)</th>
                <th>탈락 사유</th>
              </tr>
            </thead>
            <tbody>
              {decision.rejected.map((item) => (
                <tr key={item.key}>
                  <td>
                    {item.displayName}
                    <br />
                    <code>{item.key}</code>
                  </td>
                  <td className="num">{toAegis(item.amountUnits)}</td>
                  <td>{item.reasons.join(" / ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
