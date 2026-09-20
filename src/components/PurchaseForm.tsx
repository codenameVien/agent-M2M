"use client";

/**
 * 요청 폼. 제출하면 /api/purchase 를 부르고, 돌아온 기록을 그 자리에서 보여준다.
 * 결제 모드는 서버가 정한 값을 그대로 받아 표시만 한다(브라우저에서 바꿀 수 없다).
 */

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { CandidateTables, PurchaseSummary } from "@/components/DecisionView";
import { PRIORITIES, type PurchaseRecord } from "@/lib/types";

const PRIORITY_OPTIONS: { value: (typeof PRIORITIES)[number]; label: string }[] = [
  { value: "default", label: "기본 (가격 40 · 시간 30 · 지능 30)" },
  { value: "price", label: "가격 우선 (60 · 20 · 20)" },
  { value: "speed", label: "속도 우선 (20 · 60 · 20)" },
  { value: "intelligence", label: "지능 우선 (20 · 20 · 60)" },
];

const CAPABILITY_OPTIONS = ["korean", "reasoning", "vision"];

export function PurchaseForm({ mode }: { mode: "mock" | "live" }) {
  const [prompt, setPrompt] = useState("");
  const [budget, setBudget] = useState("50000");
  const [priority, setPriority] = useState<string>("default");
  const [caps, setCaps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<PurchaseRecord | null>(null);

  function toggleCap(name: string) {
    setCaps((prev) => (prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setRecord(null);
    try {
      const response = await fetch("/api/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          budgetUnits: Number(budget),
          priority,
          requiredCapabilities: caps,
        }),
      });
      const body = (await response.json()) as PurchaseRecord | { error: string };
      if (!response.ok || "error" in body) {
        setError("error" in body ? body.error : `요청 실패 (${response.status})`);
        return;
      }
      setRecord(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "요청을 보내지 못했습니다");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`mode${mode === "live" ? " live" : ""}`}>
        결제 모드: {mode === "live" ? "live — 실제 AEGIS 토큰이 Base Sepolia 에서 전송됩니다" : "mock — 실제 전송 없이 흐름만 실행됩니다"}
      </div>

      <form className="request" onSubmit={onSubmit}>
        <label>
          요청 내용
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="모델에게 시킬 일을 적습니다. 글자 수로 입력 토큰을 어림잡습니다."
            required
          />
        </label>
        <label>
          예산 (AEGIS 최소 단위, 소수점 6자리)
          <input
            type="number"
            min={0}
            step={1}
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            required
          />
          <small>예: 50000 units = 0.05 AEGIS. 금액이 예산을 넘는 후보는 점수 계산 전에 탈락합니다.</small>
        </label>
        <label>
          우선순위
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span style={{ fontWeight: 600 }}>필요 기능 (선택)</span>
          <div className="caps">
            {CAPABILITY_OPTIONS.map((name) => (
              <label key={name}>
                <input type="checkbox" checked={caps.includes(name)} onChange={() => toggleCap(name)} />
                {name}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" disabled={busy}>
          {busy ? "처리 중…" : "모델 선택 후 결제"}
        </button>
        {error !== null && <p className="error">{error}</p>}
      </form>

      {record !== null && (
        <section>
          <h2>결정</h2>
          <p className="muted">
            구매 번호 <code>{record.id}</code> · <Link href={`/purchases/${record.id}`}>상세 보기</Link>
          </p>
          <PurchaseSummary record={record} />
          <CandidateTables record={record} />
        </section>
      )}
    </>
  );
}
