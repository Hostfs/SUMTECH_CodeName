# SUMTECH_CodeName

SUMTECH 2026 루프톤 팀 서비스 저장소입니다.

## 문서

- 문제 정의와 기능 명세: `docs/problem.yaml` (작성 예정)
- 사용자 핵심 흐름: `docs/scenarios.yaml` (작성 예정)
- 진행 기록: `progress.md`

## 설치·실행

서비스 구현 단계에서 채웁니다. 앱은 `docker compose up --build`로 실행할 예정입니다.

## 환경변수

| 이름 | 용도 | 설정 위치 |
| ---- | ---- | --------- |
| `AI_GATEWAY_API_KEY` | 서비스의 AI 기능 호출(필요할 때만) | 로컬 `.env`, 배포 환경변수, GitHub Secrets |
