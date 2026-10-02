/**
 * 결제. AEGIS 토큰(ERC-20)을 선택된 모델의 수신자 주소로 보낸다.
 *
 * 기본값은 mock이다. 실제 전송은 두 가지가 모두 켜져 있을 때만 일어난다.
 *   AEGIS_PAYMENT_MODE=live
 *   AEGIS_REAL_PAYMENT_APPROVED=yes
 * 개인키는 이 파일 안에서만 읽고, 밖으로 내보내지 않는다. 화면과 기록에는 주소만 남는다.
 */

import { createPublicClient, createWalletClient, http, getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import type { PaymentMode, PaymentResult } from "./types";

export const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

export class PaymentError extends Error {}

export interface PaymentConfig {
  mode: PaymentMode;
  tokenAddress: string;
  chainId: number;
  rpcUrl: string;
  buyerAddress: string | null;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new PaymentError(`${name} 환경변수가 필요합니다`);
  }
  return value.trim();
}

/** 화면에 보여줄 수 있는 설정만 모은다. 개인키는 여기에 들어가지 않는다. */
export function paymentConfig(): PaymentConfig {
  const approved = process.env.AEGIS_REAL_PAYMENT_APPROVED === "yes";
  const requested = (process.env.AEGIS_PAYMENT_MODE ?? "mock").trim().toLowerCase();
  const mode: PaymentMode = requested === "live" && approved ? "live" : "mock";
  const key = process.env.AEGIS_BUYER_PRIVATE_KEY;
  return {
    mode,
    tokenAddress: process.env.AEGIS_TOKEN_ADDRESS ?? "",
    chainId: Number(process.env.AEGIS_CHAIN_ID ?? baseSepolia.id),
    rpcUrl: process.env.AEGIS_RPC_URL ?? "https://sepolia.base.org",
    buyerAddress:
      key === undefined || key.trim() === ""
        ? null
        : privateKeyToAccount(key.trim() as Hex).address,
  };
}

export function publicClient(config: PaymentConfig) {
  return createPublicClient({ chain: baseSepolia, transport: http(config.rpcUrl) });
}

/** 대시보드에 보여줄 구매 에이전트 지갑의 AEGIS 잔액. 조회하지 못하면 units는 null이고 사유를 남긴다. */
export async function buyerBalance(): Promise<{ units: number | null; status: string }> {
  const config = paymentConfig();
  if (config.buyerAddress === null) return { units: null, status: "잔액 조회 안 함 · 지갑 미구성" };
  if (config.tokenAddress.trim() === "") return { units: null, status: "잔액 조회 안 함 · 토큰 주소 미구성" };
  try {
    const balance = await publicClient(config).readContract({
      address: getAddress(config.tokenAddress.trim()),
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [getAddress(config.buyerAddress)],
    });
    return { units: Number(balance), status: "Base Sepolia 온체인 잔액 조회 완료" };
  } catch {
    return { units: null, status: "잔액 조회 실패 · RPC 응답 없음" };
  }
}

export async function pay(args: {
  amountUnits: number;
  recipient: string;
  purchaseId: string;
}): Promise<PaymentResult> {
  const config = paymentConfig();
  const to = getAddress(args.recipient);

  if (config.mode === "mock") {
    // 실제 전송 없이 흐름만 이어간다. 기록에 mock임을 분명히 남긴다.
    return {
      mode: "mock",
      txHash: `mock:${args.purchaseId}`,
      from: config.buyerAddress ?? "0xmock",
      to,
      amountUnits: args.amountUnits,
      tokenAddress: config.tokenAddress || "0xmock",
      chainId: config.chainId,
    };
  }

  const token = getAddress(requiredEnv("AEGIS_TOKEN_ADDRESS"));
  const account = privateKeyToAccount(requiredEnv("AEGIS_BUYER_PRIVATE_KEY") as Hex);
  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(config.rpcUrl),
  });
  const reader = publicClient(config);

  const balance = await reader.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (balance < BigInt(args.amountUnits)) {
    throw new PaymentError(
      `지갑 잔액이 부족합니다: 보유 ${balance.toString()} / 필요 ${args.amountUnits}`,
    );
  }

  const txHash = await wallet.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to, BigInt(args.amountUnits)],
  });
  const receipt = await reader.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new PaymentError(`전송이 실패했습니다: ${txHash}`);
  }

  return {
    mode: "live",
    txHash,
    from: account.address,
    to,
    amountUnits: args.amountUnits,
    tokenAddress: token,
    chainId: config.chainId,
    blockNumber: receipt.blockNumber.toString(),
  };
}
