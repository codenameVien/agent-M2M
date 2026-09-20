/** GET /api/purchases — 최근 구매 기록 목록. */

import { NextResponse } from "next/server";

import { listPurchases } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(listPurchases());
}
