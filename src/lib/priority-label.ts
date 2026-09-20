/**
 * 우선순위 라벨. "가격 우선"처럼 적으면 싸다는 뜻인지 비싸다는 뜻인지 읽는 사람이 헷갈린다.
 * 그래서 원하는 결과를 동사로 적고, 배점을 괄호에 같이 보여준다.
 */

import type { Priority } from "@/lib/types";

export const PRIORITY_LABEL: Record<Priority, string> = {
  default: "균형 있게",
  price: "싸게",
  speed: "빠르게",
  intelligence: "똑똑하게",
};

export const PRIORITY_HINT: Record<Priority, string> = {
  default: "가격 40 · 속도 30 · 성능 30",
  price: "가격 60 · 속도 20 · 성능 20",
  speed: "가격 20 · 속도 60 · 성능 20",
  intelligence: "가격 20 · 속도 20 · 성능 60",
};

/** 목록·상세에서 쓰는 한 줄 표기. */
export function priorityText(priority: Priority): string {
  return `${PRIORITY_LABEL[priority]} (${PRIORITY_HINT[priority]})`;
}
