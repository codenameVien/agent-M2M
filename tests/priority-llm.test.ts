import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { inferPriority, ollamaConfig, PriorityInferenceError } from "../src/lib/priority-llm";

/** Ollama /api/chat 가 돌려주는 모양으로 답을 흉내 낸다. */
function ollamaReply(content: string, status = 200): Response {
  return new Response(JSON.stringify({ message: { content } }), { status });
}

describe("inferPriority", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.AEGIS_OLLAMA_URL;
    delete process.env.AEGIS_OLLAMA_MODEL;
    delete process.env.AEGIS_OLLAMA_TIMEOUT_SECONDS;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("Qwen 이 고른 우선순위와 모델 이름을 돌려준다", async () => {
    const fetchMock = vi.fn(async () => ollamaReply('{"priority":"price"}'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await inferPriority("최대한 싸게 요약해 줘");

    expect(result).toEqual({ priority: "price", model: "qwen3.5:4b" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    const body = JSON.parse(init.body as string);
    expect(body.format.properties.priority.enum).toEqual(["default", "price", "speed", "intelligence"]);
    expect(body.messages[1]).toEqual({ role: "user", content: "최대한 싸게 요약해 줘" });
  });

  it("네 값 밖의 답은 받지 않는다", async () => {
    globalThis.fetch = vi.fn(async () => ollamaReply('{"priority":"cheapest"}')) as unknown as typeof fetch;
    await expect(inferPriority("싸게")).rejects.toBeInstanceOf(PriorityInferenceError);
  });

  it("Ollama 가 실패하면 모델 출력 없이 고정 메시지로 멈춘다", async () => {
    globalThis.fetch = vi.fn(async () => ollamaReply("요청 원문이 섞인 오류", 500)) as unknown as typeof fetch;
    await expect(inferPriority("싸게")).rejects.toThrow(/로컬 Qwen 우선순위 추론에 실패했습니다/);
  });

  it("루프백이 아닌 주소는 부르지 않는다", () => {
    process.env.AEGIS_OLLAMA_URL = "http://example.com:11434";
    expect(() => ollamaConfig()).toThrow(PriorityInferenceError);
  });
});
