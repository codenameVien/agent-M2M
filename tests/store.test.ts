import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import type { PurchaseRecord } from "../src/lib/types";

// store.ts 는 불러올 때 경로를 읽으므로, 환경변수를 먼저 정한 뒤 동적으로 불러온다.
const dir = mkdtempSync(path.join(tmpdir(), "agent-m2m-"));
process.env.AGENT_M2M_DB = path.join(dir, "test.db");
const store = await import("../src/lib/store");

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function sample(id: string): PurchaseRecord {
  const winner = {
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
    timeScore: 56.547619,
    aaScore: 75.181159,
    arenaScore: 75.181159,
    intelligenceScore: 75.181159,
    totalScore: 79.518633,
    rank: 1,
  };
  return {
    id,
    createdAt: new Date().toISOString(),
    prompt: "테스트 요청",
    status: "SETTLED",
    decision: {
      snapshotId: "benchmark-fixture-2026-09",
      snapshotHash: "sha256:test",
      catalogVersion: "agent-m2m-v1",
      priority: "default",
      weights: { price: 40, time: 30, intelligence: 30 },
      estimatedInputTokens: 400,
      maxOutputTokens: 8000,
      budgetUnits: 50000,
      references: {
        minAmountUnits: 12960,
        minCompletionMs: 8400,
        maxIntelligenceIndex: 41.5,
        maxArenaRating: 1400,
      },
      performanceSources: {
        aa: "Artificial Analysis 지능 지수",
        arena: "LMArena 텍스트 리더보드 Elo (overall)",
        arenaPublishDate: null,
        combine: "AA 점수와 Arena 승률 점수의 평균",
      },
      candidates: [winner],
      rejected: [],
      winner,
    },
    payment: {
      mode: "mock",
      txHash: `mock:${id}`,
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

describe("store", () => {
  it("저장한 기록을 그대로 다시 읽는다", () => {
    const record = sample("id-1");
    store.savePurchase(record);
    expect(store.purchaseExists("id-1")).toBe(true);
    expect(store.getPurchase("id-1")).toEqual(record);
    expect(store.getPurchase("없는-id")).toBeNull();
  });

  it("목록은 최신 순이다", () => {
    const older = { ...sample("id-2"), createdAt: "2026-01-01T00:00:00.000Z" };
    const newer = { ...sample("id-3"), createdAt: "2026-02-01T00:00:00.000Z" };
    store.savePurchase(older);
    store.savePurchase(newer);
    const ids = store.listPurchases().map((item) => item.id);
    expect(ids.indexOf("id-3")).toBeLessThan(ids.indexOf("id-2"));
  });

  it("같은 구매 번호는 두 번 저장되지 않는다", () => {
    expect(() => store.savePurchase(sample("id-1"))).toThrow();
  });
});
