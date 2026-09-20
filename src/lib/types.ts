/** 이 프로젝트에서 쓰는 값의 모양만 모아둔 곳. */

/** 요청이 무엇을 중요하게 보는지. 이 네 값이 가중치 한 줄을 고른다. */
export type Priority = "default" | "price" | "speed" | "intelligence";

export const PRIORITIES: readonly Priority[] = [
  "default",
  "price",
  "speed",
  "intelligence",
];

/** 가격·시간·지능에 몇 점씩 줄지. 세 값의 합은 항상 100. */
export interface Weights {
  price: number;
  time: number;
  intelligence: number;
}

/** 우선순위마다 고정된 배점표. 코드 밖에서 바꿀 수 없다. */
export const PRIORITY_WEIGHTS: Record<Priority, Weights> = {
  default: { price: 40, time: 30, intelligence: 30 },
  price: { price: 60, time: 20, intelligence: 20 },
  speed: { price: 20, time: 60, intelligence: 20 },
  intelligence: { price: 20, time: 20, intelligence: 60 },
};

/** 팔고 있는 모델 하나. 수신자 주소는 이 파일이 아니라 data/catalog.json에 적혀 있다. */
export interface CatalogEntry {
  key: string;
  /** 벤치마크를 다시 뜰 때 쓰는 Artificial Analysis 슬러그. */
  aaSlug?: string;
  providerId: string;
  providerModelId: string;
  displayName: string;
  recipient: string;
  capabilities: string[];
}

export interface Catalog {
  catalogVersion: string;
  entries: CatalogEntry[];
}

/** 벤치마크 표의 한 줄. 숫자는 문자열로 둔다(소수점 오차를 만들지 않기 위해). */
export interface BenchmarkModel {
  key: string;
  /** 이 줄이 어느 Artificial Analysis 항목에서 왔는지. */
  aaSlug?: string;
  aaModelName?: string;
  inputPricePerMillion: string;
  outputPricePerMillion: string;
  medianEndToEndSeconds: string;
  intelligenceIndex: string;
}

export interface BenchmarkSnapshot {
  snapshotId: string;
  capturedAt: string;
  source: string;
  sourceUrl?: string;
  note: string;
  models: BenchmarkModel[];
}

/** 사용자가 보낸 요청. */
export interface PurchaseRequest {
  prompt: string;
  budgetUnits: number;
  priority: Priority;
  maxOutputTokens?: number;
  requiredCapabilities?: string[];
}

/** 필터에서 떨어진 후보와 그 이유. */
export interface RejectedCandidate {
  key: string;
  displayName: string;
  amountUnits: number;
  reasons: string[];
}

/** 점수까지 매겨진 후보. */
export interface ScoredCandidate {
  key: string;
  displayName: string;
  providerId: string;
  providerModelId: string;
  recipient: string;
  amountUnits: number;
  completionMs: number;
  intelligenceIndex: number;
  priceScore: number;
  timeScore: number;
  intelligenceScore: number;
  totalScore: number;
  rank: number;
}

/** 선택이 끝난 뒤 남는 기록 전체. */
export interface Decision {
  snapshotId: string;
  snapshotHash: string;
  catalogVersion: string;
  priority: Priority;
  weights: Weights;
  estimatedInputTokens: number;
  maxOutputTokens: number;
  budgetUnits: number;
  references: {
    minAmountUnits: number;
    minCompletionMs: number;
    maxIntelligenceIndex: number;
  };
  candidates: ScoredCandidate[];
  rejected: RejectedCandidate[];
  winner: ScoredCandidate;
}

export type PaymentMode = "mock" | "live";

export interface PaymentResult {
  mode: PaymentMode;
  txHash: string;
  from: string;
  to: string;
  amountUnits: number;
  tokenAddress: string;
  chainId: number;
  /** live일 때만 채워진다. */
  blockNumber?: string;
}

export type PurchaseStatus = "SETTLED" | "FAILED";

export interface PurchaseRecord {
  id: string;
  createdAt: string;
  prompt: string;
  status: PurchaseStatus;
  decision: Decision;
  payment: PaymentResult | null;
  resultText: string | null;
  failureReason: string | null;
}
