import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { amountUnits, arenaWinScore, decide, SelectionError } from "../src/lib/select";

/** 400 입력 토큰이 나오도록 1600 바이트짜리 ASCII 요청을 만든다(4바이트 = 1토큰 어림). */
const PROMPT_400 = "a".repeat(1600);

describe("amountUnits", () => {
  it("입력 400 · 최대 출력 8000 토큰일 때 세 모델의 금액", () => {
    const base = { inputTokens: 400, maxOutputTokens: 8000 };
    expect(amountUnits({ ...base, inputPricePerMillion: "0.4", outputPricePerMillion: "1.6" })).toBe(12960);
    expect(amountUnits({ ...base, inputPricePerMillion: "1", outputPricePerMillion: "5" })).toBe(40400);
    expect(amountUnits({ ...base, inputPricePerMillion: "0.3", outputPricePerMillion: "2.5" })).toBe(20120);
  });
});

describe("decide", () => {
  it("세 후보가 모두 예산 안이면 기본 우선순위는 Gemini 2.5 Flash 를 고른다", () => {
    const decision = decide({ prompt: PROMPT_400, budgetUnits: 50_000, priority: "default" });
    expect(decision.estimatedInputTokens).toBe(400);
    expect(decision.candidates).toHaveLength(3);
    expect(decision.rejected).toHaveLength(0);
    expect(decision.winner.key).toBe("google:test-flash");
    expect(decision.winner.amountUnits).toBe(20120);
    expect(decision.weights).toEqual({ price: 40, time: 30, intelligence: 30 });
  });

  it("가격 우선이면 GPT-4.1 mini 를 고른다", () => {
    const decision = decide({ prompt: PROMPT_400, budgetUnits: 50_000, priority: "price" });
    expect(decision.winner.key).toBe("openai:test-mini");
    expect(decision.winner.amountUnits).toBe(12960);
    expect(decision.weights).toEqual({ price: 60, time: 20, intelligence: 20 });
  });

  it("reasoning 기능을 요구하면 Google 후보는 사유와 함께 탈락한다", () => {
    const decision = decide({
      prompt: PROMPT_400,
      budgetUnits: 50_000,
      priority: "default",
      requiredCapabilities: ["reasoning"],
    });
    expect(decision.candidates.map((item) => item.key)).not.toContain("google:test-flash");
    const google = decision.rejected.find((item) => item.key === "google:test-flash");
    expect(google).toBeDefined();
    expect(google!.reasons).toEqual(["필요 기능 없음: reasoning"]);
  });

  it("같은 입력이면 항상 같은 결과가 나온다", () => {
    const first = decide({ prompt: PROMPT_400, budgetUnits: 50_000, priority: "speed" });
    const second = decide({ prompt: PROMPT_400, budgetUnits: 50_000, priority: "speed" });
    expect(second).toEqual(first);
  });
});

describe("두 출처 성능 점수", () => {
  it("Arena 점수는 1등 대비 승률로 환산한다 — 1등 100점, 400점 낮으면 약 18점", () => {
    expect(arenaWinScore(1500, 1500)).toBeCloseTo(100, 6);
    expect(arenaWinScore(1100, 1500)).toBeCloseTo(200 / 11, 6);
  });

  it("성능 점수는 AA 점수와 Arena 점수의 평균이다", () => {
    const decision = decide({ prompt: PROMPT_400, budgetUnits: 50_000, priority: "intelligence" });
    for (const candidate of decision.candidates) {
      expect(candidate.intelligenceScore).toBeCloseTo((candidate.aaScore + candidate.arenaScore) / 2, 5);
    }
    // 픽스처에서 Arena 1등은 1450점짜리 Anthropic 테스트 모델이다.
    const top = decision.candidates.find((item) => item.key === "anthropic:test-haiku")!;
    expect(top.arenaScore).toBeCloseTo(100, 6);
    expect(decision.references.maxArenaRating).toBe(1450);
  });

  it("Arena 점수가 빠진 모델이 있으면 기본값으로 메우지 않고 멈춘다", () => {
    const fixtures = path.join(import.meta.dirname, "fixtures");
    const dir = mkdtempSync(path.join(tmpdir(), "agent-m2m-"));
    cpSync(fixtures, dir, { recursive: true });
    const file = path.join(dir, "benchmark.json");
    const snapshot = JSON.parse(readFileSync(file, "utf8"));
    delete snapshot.models[0].arenaRating;
    writeFileSync(file, JSON.stringify(snapshot));
    const previous = process.env.AGENT_M2M_DATA_DIR;
    process.env.AGENT_M2M_DATA_DIR = dir;
    try {
      expect(() => decide({ prompt: PROMPT_400, budgetUnits: 50_000, priority: "default" })).toThrow(
        SelectionError,
      );
    } finally {
      process.env.AGENT_M2M_DATA_DIR = previous;
    }
  });
});
