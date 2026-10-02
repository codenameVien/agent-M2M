import type { BenchmarkSnapshot, Catalog } from "./types";

export const AA_URL: string;
export const ARENA_DATASET: string;

export interface ArenaBoard {
  publishDate: string;
  rows: { model_name: string; rating: number; vote_count: number }[];
}

export function fetchAa(key: string): Promise<Record<string, unknown>[]>;
export function fetchArena(): Promise<ArenaBoard>;
export function buildSnapshot(
  catalog: Catalog,
  aaModels: Record<string, unknown>[],
  arena: ArenaBoard,
  now?: Date,
): BenchmarkSnapshot;
