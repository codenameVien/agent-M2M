import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// store.ts 는 불러올 때 접속 정보를 읽으므로, 환경변수를 먼저 정한 뒤 동적으로 불러온다.
process.env.MONGODB_DB = `agent_m2m_test_${Date.now()}_bench`;
const store = await import("../src/lib/store");
const { loadFreshSnapshot } = await import("../src/lib/benchmark");

const HOUR = 60 * 60 * 1000;
const originalFetch = globalThis.fetch;
const previousDataDir = process.env.AGENT_M2M_DATA_DIR;

// 카탈로그에 Arena 이름을 채운 임시 데이터 폴더. 시작값(benchmark.json)은 픽스처 그대로다.
beforeAll(() => {
  const dir = mkdtempSync(path.join(tmpdir(), "agent-m2m-bench-"));
  cpSync(path.join(import.meta.dirname, "fixtures"), dir, { recursive: true });
  const catalogFile = path.join(dir, "catalog.json");
  const catalog = JSON.parse(readFileSync(catalogFile, "utf8"));
  for (const entry of catalog.entries) entry.arenaModel = `${entry.aaSlug}-arena`;
  writeFileSync(catalogFile, JSON.stringify(catalog));
  process.env.AGENT_M2M_DATA_DIR = dir;
  process.env.AA_API_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

afterAll(async () => {
  process.env.AGENT_M2M_DATA_DIR = previousDataDir;
  delete process.env.AA_API_KEY;
  await store.dropTestDatabase();
  await store.closeStore();
});

const SLUGS = ["test-mini", "test-haiku", "test-flash"];

function fakeSources(): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string) => {
    if (url.startsWith("https://artificialanalysis.ai/")) {
      const data = SLUGS.map((slug) => ({
        slug,
        name: slug,
        pricing: { price_1m_input_tokens: 1, price_1m_output_tokens: 2 },
        performance: { median_end_to_end_response_time_seconds: 3 },
        evaluations: { artificial_analysis_intelligence_index: 50 },
      }));
      return new Response(JSON.stringify({ data }));
    }
    const rows = SLUGS.map((slug) => ({
      row: {
        model_name: `${slug}-arena`,
        rating: 1400,
        vote_count: 10,
        category: "overall",
        leaderboard_publish_date: "2026-10-01",
      },
    }));
    return new Response(JSON.stringify({ rows }));
  });
}

describe("loadFreshSnapshot", () => {
  it("값이 1시간보다 오래되면 실패해도 마지막 값으로 계속하고 사유를 남긴다", async () => {
    globalThis.fetch = vi.fn(async () => new Response("down", { status: 503 })) as typeof fetch;
    const result = await loadFreshSnapshot();
    expect(result.snapshot.snapshotId).toBe("test-fixture-v1");
    expect(result.refreshError).toMatch(/503/);
  });

  it("값이 오래되면 두 출처에서 새로 받아 저장한다", async () => {
    const fetchMock = fakeSources();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await loadFreshSnapshot();
    expect(result.refreshError).toBeNull();
    expect(result.snapshot.arena?.publishDate).toBe("2026-10-01");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await store.latestSnapshot()).toEqual({ snapshot: result.snapshot, hash: result.hash });
  });

  it("1시간이 지나지 않았으면 다시 받지 않는다", async () => {
    const fetchMock = fakeSources();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const latest = await store.latestSnapshot();
    const result = await loadFreshSnapshot(Date.parse(latest!.snapshot.capturedAt) + HOUR - 1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.hash).toBe(latest!.hash);
  });
});
