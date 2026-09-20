/**
 * Artificial Analysis 공개 API에서 벤치마크 표를 떠서 data/benchmark.json 으로 저장한다.
 *
 *   node scripts/capture-benchmark.mjs            (카탈로그의 모델만 저장)
 *   node scripts/capture-benchmark.mjs --list foo (슬러그 검색 — 매핑을 찾을 때)
 *
 * 키는 .env.local 의 AA_API_KEY 에서만 읽는다. 저장 파일에는 키가 들어가지 않는다.
 * 떠온 시각과 출처를 같이 적어 두어야 "그때 본 숫자"로 재계산할 수 있다.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_URL = "https://artificialanalysis.ai/api/v2/language/models/free";

function loadKey() {
  const fromEnv = process.env.AA_API_KEY;
  if (fromEnv !== undefined && fromEnv.trim() !== "") return fromEnv.trim();
  const text = readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const line = text.split("\n").find((item) => item.startsWith("AA_API_KEY="));
  if (line === undefined) throw new Error(".env.local 에 AA_API_KEY 가 없습니다");
  const value = line.slice("AA_API_KEY=".length).trim();
  if (value === "") throw new Error("AA_API_KEY 값이 비어 있습니다");
  return value;
}

function at(object, dotted) {
  return dotted.split(".").reduce((node, key) => (node == null ? undefined : node[key]), object);
}

function decimalText(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} 값이 숫자가 아닙니다: ${JSON.stringify(value)}`);
  }
  // 소수점 표기를 문자열로 고정한다. 부동소수점 재해석을 피하기 위해서다.
  return String(value);
}

const FIELDS = {
  input: "pricing.price_1m_input_tokens",
  output: "pricing.price_1m_output_tokens",
  seconds: "performance.median_end_to_end_response_time_seconds",
  intelligence: "evaluations.artificial_analysis_intelligence_index",
};

async function fetchModels(key) {
  const response = await fetch(SOURCE_URL, { headers: { "x-api-key": key } });
  if (!response.ok) {
    throw new Error(`AA API ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const body = await response.json();
  const data = Array.isArray(body?.data) ? body.data : [];
  if (data.length === 0) throw new Error("AA 응답에 모델 목록이 없습니다");
  return data;
}

const key = loadKey();
const models = await fetchModels(key);

const listIndex = process.argv.indexOf("--list");
if (listIndex !== -1) {
  const needle = (process.argv[listIndex + 1] ?? "").toLowerCase();
  for (const model of models) {
    const slug = String(model.slug ?? "");
    const name = String(model.name ?? "");
    if (needle === "" || slug.toLowerCase().includes(needle) || name.toLowerCase().includes(needle)) {
      console.log(`${slug}\t${name}`);
    }
  }
  process.exit(0);
}

const catalog = JSON.parse(readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
const captured = [];
for (const entry of catalog.entries) {
  if (typeof entry.aaSlug !== "string" || entry.aaSlug === "") {
    throw new Error(`${entry.key}: catalog.json 에 aaSlug 가 없습니다`);
  }
  const model = models.find((item) => item.slug === entry.aaSlug);
  if (model === undefined) {
    throw new Error(`AA 응답에 슬러그 ${entry.aaSlug} 가 없습니다 (--list 로 확인하세요)`);
  }
  captured.push({
    key: entry.key,
    aaSlug: entry.aaSlug,
    aaModelName: String(model.name ?? entry.aaSlug),
    inputPricePerMillion: decimalText(at(model, FIELDS.input), `${entry.key} 입력 단가`),
    outputPricePerMillion: decimalText(at(model, FIELDS.output), `${entry.key} 출력 단가`),
    medianEndToEndSeconds: decimalText(at(model, FIELDS.seconds), `${entry.key} 완료시간`),
    intelligenceIndex: decimalText(at(model, FIELDS.intelligence), `${entry.key} 지능 지수`),
  });
}

const snapshot = {
  snapshotId: `aa-${new Date().toISOString().slice(0, 10)}`,
  capturedAt: new Date().toISOString(),
  source: "artificialanalysis.ai",
  sourceUrl: SOURCE_URL,
  note: "Artificial Analysis 공개 API에서 떠온 실제 값입니다. 떠온 시각 기준이며 이후 값은 달라질 수 있습니다.",
  models: captured,
};

writeFileSync(path.join(ROOT, "data", "benchmark.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`저장 완료: data/benchmark.json (${captured.length}개 모델)`);
for (const model of captured) {
  console.log(
    `  ${model.key} → 입력 ${model.inputPricePerMillion} / 출력 ${model.outputPricePerMillion} / ` +
      `${model.medianEndToEndSeconds}초 / 지능 ${model.intelligenceIndex}`,
  );
}
