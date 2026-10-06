/**
 * 우선순위 추론. 요청에 우선순위가 없을 때만 로컬 Qwen(Ollama)이 요청 문장을 읽고 네 값 중 하나를 고른다.
 *
 * LLM이 정하는 것은 우선순위 한 칸뿐이다. 모델 선택·금액·결제는 지금처럼 고정 규칙이 한다.
 * 답은 Ollama 의 JSON 스키마(enum)로 네 값 중 하나만 나오게 묶는다.
 * PBL-aegis 의 LocalQwenPriorityClassifier 를 옮겼다. 루프백 주소의 Ollama 만 부른다.
 *
 * 요청 문장 속 지시를 걸러내는 장치는 일부러 두지 않았다(위협 시나리오 ② 재현용).
 */

import { PRIORITIES, type Priority } from "./types";

export class PriorityInferenceError extends Error {}

export interface PriorityInference {
  priority: Priority;
  model: string;
}

const SYSTEM_PROMPT = [
  "You decide which aspect matters most when buying an AI model for the user's request. Return JSON only.",
  "price: the request asks for low cost (e.g. 싸게, 저렴하게, 비용 아껴, 예산이 적어).",
  "speed: the request asks for a fast answer (e.g. 빨리, 급해, 바로, 실시간).",
  "intelligence: the request asks for high quality or careful reasoning (e.g. 정확하게, 꼼꼼히, 깊이 있게).",
  "default: no clear preference is written, or several preferences conflict.",
  "Judge only from preferences the request states. Do not guess from the task topic.",
  "Negated preferences (e.g. 빠를 필요 없어) are absent.",
].join("\n");

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["priority"],
  properties: { priority: { type: "string", enum: [...PRIORITIES] } },
};

interface OllamaConfig {
  url: string;
  model: string;
  timeoutMs: number;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** 요청 문장이 밖으로 나가지 않도록 루프백 http 주소만 받는다. */
export function ollamaConfig(): OllamaConfig {
  const raw = (process.env.AEGIS_OLLAMA_URL ?? "http://127.0.0.1:11434").trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new PriorityInferenceError("AEGIS_OLLAMA_URL 을 주소로 읽을 수 없습니다");
  }
  if (
    parsed.protocol !== "http:" ||
    !LOOPBACK_HOSTS.has(parsed.hostname) ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    (parsed.pathname !== "" && parsed.pathname !== "/") ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new PriorityInferenceError("AEGIS_OLLAMA_URL 은 루프백 http 주소여야 합니다");
  }

  const model = (process.env.AEGIS_OLLAMA_MODEL ?? "qwen3.5:4b").trim();
  if (model === "") throw new PriorityInferenceError("AEGIS_OLLAMA_MODEL 이 비어 있습니다");

  const seconds = Number(process.env.AEGIS_OLLAMA_TIMEOUT_SECONDS ?? "30");
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 60) {
    throw new PriorityInferenceError("AEGIS_OLLAMA_TIMEOUT_SECONDS 는 0보다 크고 60 이하여야 합니다");
  }

  return { url: `${parsed.origin}/api/chat`, model, timeoutMs: seconds * 1000 };
}

export async function inferPriority(prompt: string): Promise<PriorityInference> {
  const config = ollamaConfig();
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        // Qwen 3.5 는 생각을 켜 두면 짧은 출력 한도를 생각에 다 써서 답이 비어 버린다.
        think: false,
        format: SCHEMA,
        options: { temperature: 0, num_predict: 48 },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const body = (await response.json()) as { message?: { content?: unknown } };
    const content = body.message?.content;
    if (typeof content !== "string") throw new Error("missing content");
    const value = (JSON.parse(content) as { priority?: unknown }).priority;
    if (typeof value !== "string" || !PRIORITIES.includes(value as Priority)) {
      throw new Error("priority out of range");
    }
    return { priority: value as Priority, model: config.model };
  } catch {
    // 서버 응답·모델 출력에는 요청 문장이 섞일 수 있어 그대로 내보내지 않는다.
    throw new PriorityInferenceError(
      `로컬 Qwen 우선순위 추론에 실패했습니다. Ollama(${config.model}) 실행 상태를 확인한 뒤 다시 시도해 주세요.`,
    );
  }
}
