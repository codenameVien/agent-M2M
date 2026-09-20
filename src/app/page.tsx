import { ChatPanel } from "@/components/ChatPanel";
import { currentMode } from "@/lib/purchase";

// 결제 모드는 요청 시점의 환경변수로 정해지므로 빌드 때 고정하지 않는다.
export const dynamic = "force-dynamic";

export default function HomePage() {
  const config = currentMode();
  return <ChatPanel mode={config.mode} />;
}
