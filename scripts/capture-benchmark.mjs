/**
 * 두 벤치마크 출처를 떠서 data/benchmark.json 하나로 저장한다.
 *
 *   Artificial Analysis — 가격 · 응답시간 · 지능 지수 (가격과 시간을 주는 곳은 여기뿐)
 *   LMArena            — 사람 선호 투표로 매긴 Elo 점수 (Hugging Face 공식 데이터셋)
 *
 *   node scripts/capture-benchmark.mjs                 카탈로그 모델만 저장
 *   node scripts/capture-benchmark.mjs --list foo      AA 슬러그 검색
 *   node scripts/capture-benchmark.mjs --arena foo     Arena 모델 이름 검색
 *
 * 두 출처는 같은 모델을 노력 수준별로 따로 잰다. 매핑은 추측하지 않고 catalog.json 에
 * 사람이 적은 이름(aaSlug, arenaModel)으로만 찾는다. 하나라도 없으면 저장하지 않고 멈춘다.
 * AA 키는 .env.local 의 AA_API_KEY 에서만 읽고, 저장 파일에는 넣지 않는다.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const AA_URL = "https://artificialanalysis.ai/api/v2/language/models/free";
const ARENA_DATASET = "lmarena-ai/leaderboard-dataset";
const ARENA_ROWS = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(ARENA_DATASET)}&config=text&split=latest`;
const ARENA_PAGE = 100;
const ARENA_MAX_ROWS = 2_000;

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
  return String(value);
}

async function fetchAa(key) {
  const response = await fetch(AA_URL, { headers: { "x-api-key": key } });
  if (!response.ok) {
    throw new Error(`AA API ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const body = await response.json();
  const data = Array.isArray(body?.data) ? body.data : [];
  if (data.length === 0) throw new Error("AA 응답에 모델 목록이 없습니다");
  return data;
}

/** Arena 텍스트 리더보드의 가장 최근 발행분(overall)만 모은다. */
async function fetchArena() {
  const rows = [];
  for (let offset = 0; offset < ARENA_MAX_ROWS; offset += ARENA_PAGE) {
    const response = await fetch(`${ARENA_ROWS}&offset=${offset}&length=${ARENA_PAGE}`, {
      signal: AbortSignal.timeout(40_000),
    });
    if (!response.ok) throw new Error(`Arena 데이터셋 ${response.status}`);
    const body = await response.json();
    const batch = (body.rows ?? []).map((item) => item.row);
    rows.push(...batch);
    if (batch.length < ARENA_PAGE) break;
  }
  const overall = rows.filter((row) => row.category === "overall");
  if (overall.length === 0) throw new Error("Arena 데이터에 overall 순위가 없습니다");
  const publishDate = overall.map((row) => row.leaderboard_publish_date).sort().at(-1);
  return { publishDate, rows: overall.filter((row) => row.leaderboard_publish_date === publishDate) };
}

const argv = process.argv;

if (argv.includes("--arena")) {
  const needle = (argv[argv.indexOf("--arena") + 1] ?? "").toLowerCase();
  const { publishDate, rows } = await fetchArena();
  console.log(`Arena 발행일 ${publishDate}`);
  for (const row of rows) {
    if (needle === "" || row.model_name.toLowerCase().includes(needle)) {
      console.log(`${row.model_name}\t${Math.round(row.rating)}\t투표 ${row.vote_count}`);
    }
  }
  process.exit(0);
}

const aaModels = await fetchAa(loadKey());

if (argv.includes("--list")) {
  const needle = (argv[argv.indexOf("--list") + 1] ?? "").toLowerCase();
  for (const model of aaModels) {
    const slug = String(model.slug ?? "");
    const name = String(model.name ?? "");
    if (needle === "" || slug.toLowerCase().includes(needle) || name.toLowerCase().includes(needle)) {
      console.log(`${slug}\t${name}`);
    }
  }
  process.exit(0);
}

const arena = await fetchArena();
const catalog = JSON.parse(readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
const captured = [];
for (const entry of catalog.entries) {
  const aa = aaModels.find((item) => item.slug === entry.aaSlug);
  if (aa === undefined) throw new Error(`AA 에 슬러그 ${entry.aaSlug} 가 없습니다 (--list 로 확인)`);
  const board = arena.rows.find((row) => row.model_name === entry.arenaModel);
  if (board === undefined) {
    throw new Error(`Arena 에 ${entry.arenaModel} 가 없습니다 (--arena 로 확인)`);
  }
  captured.push({
    key: entry.key,
    aaSlug: entry.aaSlug,
    aaModelName: String(aa.name ?? entry.aaSlug),
    inputPricePerMillion: decimalText(at(aa, "pricing.price_1m_input_tokens"), `${entry.key} 입력 단가`),
    outputPricePerMillion: decimalText(at(aa, "pricing.price_1m_output_tokens"), `${entry.key} 출력 단가`),
    medianEndToEndSeconds: decimalText(
      at(aa, "performance.median_end_to_end_response_time_seconds"),
      `${entry.key} 완료시간`,
    ),
    intelligenceIndex: decimalText(
      at(aa, "evaluations.artificial_analysis_intelligence_index"),
      `${entry.key} 지능 지수`,
    ),
    arenaModel: entry.arenaModel,
    arenaRating: decimalText(Number(board.rating.toFixed(2)), `${entry.key} Arena 점수`),
    arenaVotes: Number(board.vote_count),
  });
}

const now = new Date().toISOString();
const snapshot = {
  snapshotId: `aa-arena-${now.slice(0, 10)}`,
  capturedAt: now,
  source: "artificialanalysis.ai + lmarena",
  sourceUrl: AA_URL,
  arena: { dataset: ARENA_DATASET, category: "overall", publishDate: arena.publishDate },
  note:
    "가격·응답시간·지능 지수는 Artificial Analysis, Elo는 LMArena 공식 데이터셋에서 떠온 실제 값입니다. " +
    "두 출처가 잰 노력 수준은 catalog.json 의 effortPairing 에 적어 두었습니다.",
  models: captured,
};

writeFileSync(path.join(ROOT, "data", "benchmark.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`저장 완료: data/benchmark.json (${captured.length}개 모델, Arena 발행일 ${arena.publishDate})`);
for (const model of captured) {
  console.log(
    `  ${model.key}: $${model.inputPricePerMillion}/${model.outputPricePerMillion} · ` +
      `${model.medianEndToEndSeconds}초 · AA ${model.intelligenceIndex} · Arena ${model.arenaRating}`,
  );
}
