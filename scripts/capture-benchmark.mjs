/**
 * 두 벤치마크 출처를 떠서 data/benchmark.json 하나로 저장한다. 수집 로직은
 * src/lib/benchmark-sources.mjs 에 있고, 앱도 구매 때 같은 로직으로 값을 갱신한다.
 * 이 파일은 시작값(data/benchmark.json)을 손으로 다시 뜨거나 이름을 검색할 때 쓴다.
 *
 *   node scripts/capture-benchmark.mjs                 카탈로그 모델만 저장
 *   node scripts/capture-benchmark.mjs --list foo      AA 슬러그 검색
 *   node scripts/capture-benchmark.mjs --arena foo     Arena 모델 이름 검색
 *
 * AA 키는 .env.local 의 AA_API_KEY 에서만 읽고, 저장 파일에는 넣지 않는다.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { buildSnapshot, fetchAa, fetchArena } from "../src/lib/benchmark-sources.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

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
const snapshot = buildSnapshot(catalog, aaModels, arena);
const captured = snapshot.models;

writeFileSync(path.join(ROOT, "data", "benchmark.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`저장 완료: data/benchmark.json (${captured.length}개 모델, Arena 발행일 ${arena.publishDate})`);
for (const model of captured) {
  console.log(
    `  ${model.key}: $${model.inputPricePerMillion}/${model.outputPricePerMillion} · ` +
      `${model.medianEndToEndSeconds}초 · AA ${model.intelligenceIndex} · Arena ${model.arenaRating}`,
  );
}
