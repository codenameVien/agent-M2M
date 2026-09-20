/**
 * 판매창구. 파는 쪽 역할을 흉내 내는 코드다.
 *
 * 돈을 받았는지 스스로 확인한 뒤에만 결과를 준다. 구매 쪽이 "보냈다"고 말한 것을 믿지 않고,
 * live 모드에서는 체인의 거래 기록을 직접 읽어 수신자와 금액을 대조한다.
 * 모델 출력 자체는 Mock이다. 실제 OpenAI·Anthropic·Google API를 부르지 않는다.
 */

import { decodeEventLog, getAddress } from "viem";

import { ERC20_ABI, paymentConfig, publicClient } from "./payment";
import type { PaymentResult, ScoredCandidate } from "./types";

export class DeliveryError extends Error {}

/** 체인에 남은 전송 기록이 이 구매의 조건과 같은지 확인한다. */
export async function verifyPayment(payment: PaymentResult, winner: ScoredCandidate): Promise<void> {
  if (payment.mode === "mock") {
    if (!payment.txHash.startsWith("mock:")) {
      throw new DeliveryError("mock 결제인데 거래번호 형식이 다릅니다");
    }
    return;
  }

  const config = paymentConfig();
  const reader = publicClient(config);
  const receipt = await reader.getTransactionReceipt({ hash: payment.txHash as `0x${string}` });
  if (receipt.status !== "success") {
    throw new DeliveryError("체인에서 실패한 거래입니다");
  }

  const token = getAddress(payment.tokenAddress);
  const expectedTo = getAddress(winner.recipient);
  const matched = receipt.logs.some((log) => {
    if (getAddress(log.address) !== token) return false;
    try {
      const event = decodeEventLog({ abi: ERC20_ABI, data: log.data, topics: log.topics });
      if (event.eventName !== "Transfer") return false;
      const args = event.args as { to: `0x${string}`; value: bigint };
      return getAddress(args.to) === expectedTo && args.value === BigInt(winner.amountUnits);
    } catch {
      return false;
    }
  });
  if (!matched) {
    throw new DeliveryError(
      "이 거래에는 약속한 수신자에게 약속한 금액을 보낸 기록이 없습니다",
    );
  }
}

/** 결제가 확인된 뒤에만 불린다. 실제 모델 호출 자리를 Mock 문장으로 채운다. */
export function mockResult(prompt: string, winner: ScoredCandidate): string {
  const head = prompt.trim().slice(0, 60);
  return [
    `[Mock 응답 · ${winner.displayName}]`,
    `요청 요약: ${head}${prompt.trim().length > 60 ? "…" : ""}`,
    "",
    "이 문장은 실제 모델 출력이 아니라 이 프로젝트가 만든 예시 응답입니다.",
    `결제가 확인된 뒤 ${winner.providerModelId} 창구가 반환한 자리입니다.`,
  ].join("\n");
}
