# agent-M2M 작업 안내

공통 규칙은 `/Users/vien/AGENTS.md`를 따른다. 이 폴더의 `README.md`를 먼저 읽고, 하위 프로젝트에 별도 `AGENTS.md`가 있으면 해당 범위의 안내도 함께 읽는다.

- 프로젝트 범위·실행 명령·결제 모드는 `README.md`를 기준으로 확인한다. 고정 규칙으로 후보를 선택하는 구조와 모델 응답이 Mock인 데모 범위를 유지한다.
- 관련 코드는 `src/`, 테스트는 `tests/`, 도구는 `scripts/`, 로컬 자료는 `data/`에 있다. 결제·실행 기록을 담은 기존 데이터는 설명문 작성 대상과 구별한다.
- `npm test`, `npm run typecheck`, `npm run build`는 package.json에 정의된 검증 명령이다. 변경 범위에 맞게 사용하며 실행하지 않은 검증을 완료로 적지 않는다.
- README에 적힌 mock/live 구분과 실제 결제 활성화 조건을 보존한다. 문서 정리를 위해 결제 모드를 변경하지 않는다.

이 폴더의 에이전트 지시 원본은 `AGENTS.md`이며, `CLAUDE.md`는 `AGENTS.md`를 가리키는 상대 심링크로 유지한다.
