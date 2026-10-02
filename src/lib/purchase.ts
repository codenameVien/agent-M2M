/**
 * 구매 한 건의 전체 흐름.
 *
 *   요청 → 모델 선택 → 결제 → 판매창구 확인 → 결과 → 기록
 *
 * 실패하면 결과 없이 실패 사유를 남긴다. 실패한 건을 자동으로 다시 결제하지 않는다.
 */

import { randomUUID } from "node:crypto";

import { loadFreshSnapshot } from "./benchmark";
import { pay, PaymentError, paymentConfig } from "./payment";
import { DeliveryError, mockResult, verifyPayment } from "./provider";
import { decide, SelectionError } from "./select";
import { purchaseExists, savePurchase } from "./store";
import type { PurchaseRecord, PurchaseRequest } from "./types";

export async function runPurchase(request: PurchaseRequest): Promise<PurchaseRecord> {
  const id = randomUUID();
  if (await purchaseExists(id)) throw new Error("구매 번호가 중복되었습니다");

  // 1) 선택 — 여기서 실패하면 결제는 시작조차 하지 않는다.
  const source = await loadFreshSnapshot();
  const decision = decide(request, source);
  if (source.refreshError !== null) decision.snapshotRefreshError = source.refreshError;
  const createdAt = new Date().toISOString();

  try {
    // 2) 결제
    const payment = await pay({
      amountUnits: decision.winner.amountUnits,
      recipient: decision.winner.recipient,
      purchaseId: id,
    });

    // 3) 판매창구가 스스로 확인한 뒤에만 결과를 준다.
    await verifyPayment(payment, decision.winner);
    const resultText = mockResult(request.prompt, decision.winner);

    const record: PurchaseRecord = {
      id,
      createdAt,
      prompt: request.prompt,
      status: "SETTLED",
      decision,
      payment,
      resultText,
      failureReason: null,
    };
    await savePurchase(record);
    return record;
  } catch (error) {
    const reason =
      error instanceof PaymentError || error instanceof DeliveryError || error instanceof SelectionError
        ? error.message
        : error instanceof Error
          ? error.message
          : "알 수 없는 오류";
    const record: PurchaseRecord = {
      id,
      createdAt,
      prompt: request.prompt,
      status: "FAILED",
      decision,
      payment: null,
      resultText: null,
      failureReason: reason,
    };
    await savePurchase(record);
    return record;
  }
}

export function currentMode(): ReturnType<typeof paymentConfig> {
  return paymentConfig();
}
