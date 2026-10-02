/**
 * 두 벤치마크 출처에서 값을 떠서 스냅샷 하나로 만든다.
 * 앱(구매 시 자동 갱신)과 scripts/capture-benchmark.mjs 가 같이 쓴다.
 *
 *   Artificial Analysis — 가격 · 응답시간 · 지능 지수 (가격과 시간을 주는 곳은 여기뿐)
 *   LMArena            — 사람 선호 투표로 매긴 Elo 점수 (Hugging Face 공식 데이터셋)
 *
 * 두 출처는 같은 모델을 노력 수준별로 따로 잰다. 매핑은 추측하지 않고 catalog.json 에
 * 사람이 적은 이름(aaSlug, arenaModel)으로만 찾는다. 하나라도 없으면 스냅샷을 만들지 않고 멈춘다.
 */

export const AA_URL = "https://artificialanalysis.ai/api/v2/language/models/free";
export const ARENA_DATASET = "lmarena-ai/leaderboard-dataset";
const ARENA_ROWS = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(ARENA_DATASET)}&config=text&split=latest`;
const ARENA_PAGE = 100;
const ARENA_MAX_ROWS = 2_000;

function at(object, dotted) {
  return dotted.split(".").reduce((node, key) => (node == null ? undefined : node[key]), object);
}

function decimalText(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} 값이 숫자가 아닙니다: ${JSON.stringify(value)}`);
  }
  return String(value);
}

export async function fetchAa(key) {
  const response = await fetch(AA_URL, { headers: { "x-api-key": key }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    throw new Error(`AA API ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const body = await response.json();
  const data = Array.isArray(body?.data) ? body.data : [];
  if (data.length === 0) throw new Error("AA 응답에 모델 목록이 없습니다");
  return data;
}

/** Arena 텍스트 리더보드의 가장 최근 발행분(overall)만 모은다. */
export async function fetchArena() {
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

/** 카탈로그 모델마다 두 출처의 값을 짝지어 스냅샷을 만든다. */
export function buildSnapshot(catalog, aaModels, arena, now = new Date()) {
  const models = catalog.entries.map((entry) => {
    const aa = aaModels.find((item) => item.slug === entry.aaSlug);
    if (aa === undefined) throw new Error(`AA 에 슬러그 ${entry.aaSlug} 가 없습니다 (--list 로 확인)`);
    const board = arena.rows.find((row) => row.model_name === entry.arenaModel);
    if (board === undefined) {
      throw new Error(`Arena 에 ${entry.arenaModel} 가 없습니다 (--arena 로 확인)`);
    }
    return {
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
    };
  });

  const iso = now.toISOString();
  return {
    snapshotId: `aa-arena-${iso.slice(0, 16)}`,
    capturedAt: iso,
    source: "artificialanalysis.ai + lmarena",
    sourceUrl: AA_URL,
    arena: { dataset: ARENA_DATASET, category: "overall", publishDate: arena.publishDate },
    note:
      "가격·응답시간·지능 지수는 Artificial Analysis, Elo는 LMArena 공식 데이터셋에서 떠온 실제 값입니다. " +
      "두 출처가 잰 노력 수준은 catalog.json 의 effortPairing 에 적어 두었습니다.",
    models,
  };
}
