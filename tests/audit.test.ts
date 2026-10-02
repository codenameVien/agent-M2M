import { describe, expect, it } from "vitest";

import { auditPurchase, combineSeverity } from "../src/lib/audit";
import type { PurchaseRecord, ScoredCandidate } from "../src/lib/types";

const winner: ScoredCandidate = {
  key: "openai:gpt-4.1-mini-2025-04-14",
  displayName: "OpenAI GPT-4.1 mini",
  providerId: "openai",
  providerModelId: "gpt-4.1-mini-2025-04-14",
  recipient: "0xF00E8e0ecEF3B405250242F932849edB409497a0",
  amountUnits: 12960,
  completionMs: 8400,
  intelligenceIndex: 41.5,
  arenaModel: "test-mini",
  arenaRating: 1400,
  effortPairing: "테스트",
  priceScore: 100,
  timeScore: 56.5,
  aaScore: 75.2,
  arenaScore: 75.2,
  intelligenceScore: 75.2,
  totalScore: 79.5,
  rank: 1,
};

function sample(): PurchaseRecord {
  return {
    id: "id-1",
    createdAt: "2026-10-02T00:00:00.000Z",
    prompt: "테스트 요청",
    status: "SETTLED",
    decision: {
      snapshotId: "benchmark-fixture",
      snapshotHash: "sha256:test",
      catalogVersion: "agent-m2m-v1",
      priority: "default",
      weights: { price: 40, time: 30, intelligence: 30 },
      estimatedInputTokens: 400,
      maxOutputTokens: 8000,
      budgetUnits: 50000,
      references: { minAmountUnits: 12960, minCompletionMs: 8400, maxIntelligenceIndex: 41.5, maxArenaRating: 1400 },
      performanceSources: { aa: "aa", arena: "arena", arenaPublishDate: null, combine: "avg" },
      candidates: [winner],
      rejected: [],
      winner,
    },
    payment: {
      mode: "mock",
      txHash: "mock:id-1",
      from: "0xmock",
      to: winner.recipient,
      amountUnits: 12960,
      tokenAddress: "0xmock",
      chainId: 84532,
    },
    resultText: "결과",
    failureReason: null,
  };
}

function codes(record: PurchaseRecord): string[] {
  return auditPurchase(record).map((finding) => finding.code);
}

describe("audit", () => {
  it("규칙에 맞는 기록은 정상이다", () => {
    expect(auditPurchase(sample())).toEqual([]);
    expect(combineSeverity(auditPurchase(sample()))).toBe("NORMAL");
  });

  it("결제 금액·수신자가 선택과 다르면 위험", () => {
    const record = sample();
    record.payment = { ...record.payment!, amountUnits: 99999, to: "0x0000000000000000000000000000000000000001" };
    expect(codes(record)).toEqual(["AUD-PAYMENT-AMOUNT-MISMATCH", "AUD-RECIPIENT-MISMATCH"]);
    expect(combineSeverity(auditPurchase(record))).toBe("RISK");
  });

  it("예산 초과·가중치 불일치·최고 점수 아닌 선택을 잡는다", () => {
    const record = sample();
    const better = { ...winner, key: "other", displayName: "Other", totalScore: 90, rank: 1 };
    record.decision = {
      ...record.decision,
      budgetUnits: 100,
      weights: { price: 60, time: 20, intelligence: 20 },
      candidates: [better, { ...winner, rank: 2 }],
      winner: { ...winner, rank: 2 },
    };
    expect(codes(record)).toEqual(["AUD-WEIGHTS-MISMATCH", "AUD-WINNER-NOT-TOP", "AUD-BUDGET-EXCEEDED"]);
  });

  it("실패와 이전 스냅샷 사용, 블록 번호 없는 실결제를 표시한다", () => {
    const record = sample();
    record.status = "FAILED";
    record.failureReason = "잔액 부족";
    record.decision = { ...record.decision, snapshotRefreshError: "timeout" };
    record.payment = { ...record.payment!, mode: "live" };
    expect(codes(record)).toEqual(["AUD-LIVE-BLOCK-MISSING", "AUD-PAYMENT-FAILED", "AUD-SNAPSHOT-STALE"]);
  });

  it("주의만 있으면 주의", () => {
    const record = sample();
    record.decision = { ...record.decision, snapshotRefreshError: "timeout" };
    expect(combineSeverity(auditPurchase(record))).toBe("CAUTION");
  });
});
