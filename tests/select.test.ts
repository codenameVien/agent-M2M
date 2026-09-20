import { describe, expect, it } from "vitest";

import { amountUnits, decide, SelectionError } from "../src/lib/select";

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
    expect(decision.winner.key).toBe("google:gemini-2.5-flash");
    expect(decision.winner.amountUnits).toBe(20120);
    expect(decision.weights).toEqual({ price: 40, time: 30, intelligence: 30 });
  });

  it("가격 우선이면 GPT-4.1 mini 를 고른다", () => {
    const decision = decide({ prompt: PROMPT_400, budgetUnits: 50_000, priority: "price" });
    expect(decision.winner.key).toBe("openai:gpt-4.1-mini-2025-04-14");
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
    expect(decision.candidates.map((item) => item.key)).not.toContain("google:gemini-2.5-flash");
    const google = decision.rejected.find((item) => item.key === "google:gemini-2.5-flash");
    expect(google).toBeDefined();
    expect(google!.reasons).toEqual(["필요 기능 없음: reasoning"]);
  });

  it("예산이 모든 후보 금액보다 작으면 SelectionError 를 던진다", () => {
    expect(() => decide({ prompt: PROMPT_400, budgetUnits: 1_000, priority: "default" })).toThrow(SelectionError);
  });

  it("같은 입력이면 항상 같은 결과가 나온다", () => {
    const first = decide({ prompt: PROMPT_400, budgetUnits: 50_000, priority: "speed" });
    const second = decide({ prompt: PROMPT_400, budgetUnits: 50_000, priority: "speed" });
    expect(second).toEqual(first);
  });
});
