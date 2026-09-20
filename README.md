# agent-M2M

AI 구매 에이전트가 벤치마크 표를 보고 모델 하나를 고른 뒤, AEGIS 토큰(Base Sepolia ERC-20)으로 값을 치르고, 판매창구가 결제를 확인한 뒤에만 결과를 돌려주는 데모입니다. 모델 선택에는 LLM이 없고 고정된 가중치 계산만 있어서, 왜 그 모델이 골라졌는지 후보별 점수와 탈락 사유를 그대로 열어볼 수 있습니다. 모델 출력은 Mock이며 실제 OpenAI·Anthropic·Google API를 부르지 않습니다.

## 흐름

요청 → 선택 → 결제 → 확인 → 결과 → 기록

1. **요청**: 요청 내용, 예산(units), 우선순위(기본·가격·속도·지능), 필요 기능.
2. **선택**: 후보마다 금액 계산 → 예산·필요 기능으로 하드 필터 → 살아남은 후보끼리 가격·시간·지능 점수 → 가중치 합산 → 고정 규칙으로 동점 처리.
3. **결제**: 선택된 모델의 수신자 주소로 AEGIS `transfer` (기본은 mock).
4. **확인**: 판매창구가 체인의 Transfer 기록에서 수신자·금액을 대조(live일 때).
5. **결과**: Mock 응답 문장.
6. **기록**: 후보·점수·탈락 사유·가중치·스냅샷 해시·거래번호를 SQLite에 덧붙임.

## 실행

```bash
npm install
npm run dev        # http://localhost:3100
npm test           # vitest
npm run typecheck
npm run build
```

## 환경변수

`.env.example`을 `.env.local`로 복사해서 씁니다. 값은 `.env.local`에만 넣습니다.

| 이름 | 기본값 | 뜻 |
| --- | --- | --- |
| `AEGIS_PAYMENT_MODE` | `mock` | `live`면 실제 전송을 요청 |
| `AEGIS_REAL_PAYMENT_APPROVED` | `no` | `yes`여야 live가 실제로 켜짐 |
| `AEGIS_TOKEN_ADDRESS` | `0x3440…4a4b` | Base Sepolia에 배포된 AEGIS 토큰(소수점 6자리) |
| `AEGIS_CHAIN_ID` | `84532` | Base Sepolia |
| `AEGIS_RPC_URL` | `https://sepolia.base.org` | RPC |
| `AEGIS_BUYER_PRIVATE_KEY` | (비움) | 구매자 지갑 개인키. live에서만 필요 |
| `AEGIS_MAX_TRANSACTION_UNITS` | `100000` | 1건 상한(units) |
| `AGENT_M2M_DB` | `data/agent-m2m.db` | SQLite 파일 경로 |

> **경고** — 실제 토큰 전송은 기본적으로 일어나지 않습니다(mock). `AEGIS_PAYMENT_MODE=live` **와** `AEGIS_REAL_PAYMENT_APPROVED=yes` 두 변수가 모두 켜져 있고 개인키가 있을 때만 Base Sepolia에서 실제 `transfer`가 실행됩니다. 개인키는 절대 커밋하지 마세요.

## 기술 스택

Next.js 15 (App Router) · React 19 · TypeScript · viem · better-sqlite3 · vitest

## 벤치마크 값 갱신

`data/benchmark.json` 은 Artificial Analysis 공개 API에서 떠온 실제 값입니다. 다시 뜨려면:

```bash
node scripts/capture-benchmark.mjs
```

`.env.local` 의 `AA_API_KEY` 를 읽고, `data/catalog.json` 의 `aaSlug` 로 모델을 찾아 저장합니다.
슬러그를 모를 때는 `node scripts/capture-benchmark.mjs --list gemini` 처럼 검색하면 됩니다.

떠온 시각(`capturedAt`)과 출처가 파일에 함께 저장되고, 결정 기록에는 그 파일의 해시가 남습니다.
나중에 같은 숫자로 재계산할 수 있게 하기 위해서입니다. 테스트는 `tests/fixtures/` 의 고정 숫자만
보므로 이 파일을 갱신해도 테스트는 흔들리지 않습니다.
