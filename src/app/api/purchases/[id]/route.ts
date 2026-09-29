/** GET /api/purchases/:id — 구매 기록 한 건. */

import { NextResponse } from "next/server";

import { getPurchase } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const record = await getPurchase(id);
  if (record === null) {
    return NextResponse.json({ error: "해당 구매 기록이 없습니다" }, { status: 404 });
  }
  return NextResponse.json(record);
}
