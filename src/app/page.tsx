import { PurchaseForm } from "@/components/PurchaseForm";
import { currentMode } from "@/lib/purchase";

// 결제 모드는 요청 시점의 환경변수로 정해지므로 빌드 때 고정하지 않는다.
export const dynamic = "force-dynamic";

export default function HomePage() {
  const config = currentMode();
  return (
    <>
      <h1>새 요청</h1>
      <p className="muted">
        요청 → 모델 선택 → 결제 → 판매창구 확인 → 결과 → 기록. 선택은 고정된 벤치마크 표와 가중치로만 계산합니다.
      </p>
      <PurchaseForm mode={config.mode} />
    </>
  );
}
