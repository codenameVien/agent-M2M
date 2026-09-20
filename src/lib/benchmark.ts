/**
 * 벤치마크 표와 판매 목록을 읽어오는 곳.
 *
 * 표는 고른 순간의 값으로 고정되어야 한다. 그래서 파일을 읽은 뒤 내용 전체의 지문(해시)을
 * 같이 만들어 두고, 결정 기록에 그 지문을 남긴다. 나중에 같은 계산을 다시 해볼 때
 * "그때 본 숫자"가 무엇이었는지 확인할 수 있다.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { BenchmarkModel, BenchmarkSnapshot, Catalog, CatalogEntry } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function readJson<T>(fileName: string): { value: T; hash: string } {
  const raw = readFileSync(path.join(DATA_DIR, fileName), "utf8");
  const hash = `sha256:${createHash("sha256").update(raw).digest("hex")}`;
  return { value: JSON.parse(raw) as T, hash };
}

export function loadSnapshot(): { snapshot: BenchmarkSnapshot; hash: string } {
  const { value, hash } = readJson<BenchmarkSnapshot>("benchmark.json");
  return { snapshot: value, hash };
}

export function loadCatalog(): Catalog {
  return readJson<Catalog>("catalog.json").value;
}

/** 카탈로그의 모델과 벤치마크 줄을 키로 짝지어 준다. 짝이 없으면 구매를 멈춘다. */
export function pairEntries(
  catalog: Catalog,
  snapshot: BenchmarkSnapshot,
): { entry: CatalogEntry; metrics: BenchmarkModel }[] {
  return catalog.entries.map((entry) => {
    const metrics = snapshot.models.find((model) => model.key === entry.key);
    if (metrics === undefined) {
      throw new Error(`벤치마크 표에 ${entry.key} 의 숫자가 없습니다`);
    }
    return { entry, metrics };
  });
}
