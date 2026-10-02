/**
 * 감사. 저장된 구매 기록 한 건을 고정 규칙으로 다시 확인한다.
 *
 * PBL-aegis 감사 서버의 결정적 규칙 중 이 프로젝트 기록으로 확인할 수 있는 것만 옮겼다.
 * 기록은 고치지 않으므로 결과를 저장하지 않고 볼 때마다 계산한다.
 */

import { aegisText } from "./format";
import type { PurchaseRecord } from "./types";
import { PRIORITY_WEIGHTS } from "./types";

export type AuditSeverity = "NORMAL" | "CAUTION" | "RISK";

export interface AuditFinding {
  code: string;
  severity: Exclude<AuditSeverity, "NORMAL">;
  title: string;
  detail: string;
}

export function auditPurchase(record: PurchaseRecord): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const { decision, payment } = record;
  const winner = decision.winner;

  const expected = PRIORITY_WEIGHTS[decision.priority];
  if (
    expected.price !== decision.weights.price ||
    expected.time !== decision.weights.time ||
    expected.intelligence !== decision.weights.intelligence
  ) {
    findings.push({
      code: "AUD-WEIGHTS-MISMATCH",
      severity: "RISK",
      title: "결정에 쓰인 가중치가 우선순위 배점표와 다릅니다",
      detail: `우선순위 ${decision.priority}의 배점은 가격 ${expected.price} · 시간 ${expected.time} · 성능 ${expected.intelligence}입니다.`,
    });
  }

  const best = [...decision.candidates].sort((a, b) => b.totalScore - a.totalScore)[0];
  if (best === undefined || best.key !== winner.key || winner.rank !== 1) {
    findings.push({
      code: "AUD-WINNER-NOT-TOP",
      severity: "RISK",
      title: "선택된 모델이 최고 점수 후보가 아닙니다",
      detail: `최고 점수 후보는 ${best?.displayName ?? "없음"}인데 ${winner.displayName}이(가) 선택됐습니다.`,
    });
  }

  if (winner.amountUnits > decision.budgetUnits) {
    findings.push({
      code: "AUD-BUDGET-EXCEEDED",
      severity: "RISK",
      title: "결제 금액이 요청 예산을 초과했습니다",
      detail: `예산 ${aegisText(decision.budgetUnits)}보다 큰 ${aegisText(winner.amountUnits)}가 선택됐습니다.`,
    });
  }

  if (payment !== null) {
    if (payment.amountUnits !== winner.amountUnits) {
      findings.push({
        code: "AUD-PAYMENT-AMOUNT-MISMATCH",
        severity: "RISK",
        title: "실제 결제 금액이 선택된 금액과 다릅니다",
        detail: `선택 금액 ${aegisText(winner.amountUnits)}, 결제 금액 ${aegisText(payment.amountUnits)}.`,
      });
    }
    if (payment.to.toLowerCase() !== winner.recipient.toLowerCase()) {
      findings.push({
        code: "AUD-RECIPIENT-MISMATCH",
        severity: "RISK",
        title: "결제 수신자가 선택된 모델의 수신자와 다릅니다",
        detail: `기대 수신자 ${winner.recipient}, 실제 수신자 ${payment.to}.`,
      });
    }
    if (payment.mode === "live" && !payment.blockNumber) {
      findings.push({
        code: "AUD-LIVE-BLOCK-MISSING",
        severity: "CAUTION",
        title: "실결제인데 블록 번호가 기록되지 않았습니다",
        detail: "온체인 포함 여부를 거래번호로 직접 확인해야 합니다.",
      });
    }
  }

  if (record.status === "FAILED") {
    findings.push({
      code: "AUD-PAYMENT-FAILED",
      severity: "RISK",
      title: "결제가 완료되지 않았습니다",
      detail: record.failureReason ?? "실패 사유가 기록되지 않았습니다.",
    });
  }

  if (decision.snapshotRefreshError) {
    findings.push({
      code: "AUD-SNAPSHOT-STALE",
      severity: "CAUTION",
      title: "최신 벤치마크를 받지 못해 이전 값으로 골랐습니다",
      detail: decision.snapshotRefreshError,
    });
  }

  return findings;
}

/** 경고 중 가장 높은 단계. 경고가 없으면 정상. */
export function combineSeverity(findings: AuditFinding[]): AuditSeverity {
  if (findings.some((finding) => finding.severity === "RISK")) return "RISK";
  if (findings.length > 0) return "CAUTION";
  return "NORMAL";
}

export const SEVERITY_LABEL: Record<AuditSeverity, string> = {
  NORMAL: "정상",
  CAUTION: "주의",
  RISK: "위험",
};

/** 배지 색 클래스. globals.css의 .badge.ok/.warn/.risk 와 맞춘다. */
export const SEVERITY_TONE: Record<AuditSeverity, string> = {
  NORMAL: "ok",
  CAUTION: "warn",
  RISK: "risk",
};
