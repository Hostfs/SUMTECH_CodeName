# 우리 팀 진행 기록

Agent가 서비스 저장소 루트의 `progress.md`로 복사해 이어 쓴다(`docs/` 아래에 두지 않는다). 필수 제출 양식을 대신하는 문서가 아니다. 비밀번호·토큰·팀 로그인 코드는 적지 않는다.

## 현재 상태

- 실제 서비스 저장소 폴더: C:\projects\SUMTECH_CodeName
- 현재 단계 / 다음 행동: 2단계 문서 push 완료(466ab76). 3단계 진행 중: Spring Boot + MariaDB 백엔드·5NF 스키마(823f4eb), Vite + React 화면과 AI(택 분석·제품 검색·추천) API 커밋 완료(06122d7). 다음: R03 대표 이미지 정리 구현, workflows/scenarios.yml·e2e/ 추가, docker CI 확인, 첫 배포
- 2026-10-29 기획안(캔버스) 대비 구현 점검(코드 정독, 실행 검증은 안 함):
  - 구현됨: R00 회원가입·로그인·계정 분리, R01 택 다중 사진 AI 판독·원문·확인 필요 표시·직접 입력 대체, R02 웹 검색 후보(실제 열리는 페이지만, 출처·조회 시점·일치 근거)·검색 실패 시 계속, R04 보기 기준 6종·다중 계절·컬렉션, R05 회색 3D 모형·치수·기본 비율 표시·면책 문구·코디 저장, R06 사용 가능 옷만·없는 ID 버림·3D로 입혀 보기, R07 공간 트리·배치 추천(미확정)·배치 완료·초과 수량·위치 경로, R08 관리함 오늘/기한 지남·회수 완료→위치 미확인→재배치 확인, R09 같은 의류 ID 기반 상태 계산, R10 404 화면·AI 실패 문구
  - 미구현 → 2026-10-29 구현: R03 브라우저 캔버스에서 가장자리와 이어진 단색 배경만 투명 처리(픽셀 색은 그대로), 정사각 1024px 가운데 정렬·여백 12%. 등록 저장 직후 대표 이미지 자동 정리, 옷 상세에 정리본·원본 나란히 보기와 '다시 처리'. 실패하면 image_processings.result_image_id=NULL로 기록하고 원본이 대표 이미지로 남음. API POST /api/garments/{id}/images/{imageId}/processing. 백엔드 통합 테스트 1개 추가(로컬에 JDK 21·MariaDB 없어 CI로 확인), 프런트 lint·build 통과
  - R02 보완: 직접 찍은 사진 없이 제품 후보를 고르면 서버가 후보 이미지를 내려받아(공인 주소만, 10MB·JPG/PNG/WEBP) 제품 이미지 원본으로 저장하고 대표 이미지로 씀
  - 미흡: R00 '예시 옷장 둘러보기'는 랜딩의 고정 미리보기뿐, 문제정의 근거(experiences·sources·인터뷰) 비어 있음
  - 한계: 배경이 복잡하거나 옷과 배경색이 비슷하면 지우지 않고 원본 유지(정밀 누끼 모델은 쓰지 않음)
  - R03 main 반영 a1a93fd. 팀원 커밋 c82fb5e의 POST /api/images/{id}/processed(옷·대표 이미지에 연결하지 않음, 화면에서 안 씀)는 그대로 둠 → 하나로 정리할지 팀 확인 필요
- 2026-10-29 학생 지적 3건 수정(R07·R01): ① 옷장 지도에서 추천 없이 바로 넣기(미배치 옷 골라 '선택한 옷 넣기', 공간 카드 '옷 넣기', POST /api/spaces/{id}/garments, 가장 안쪽 공간만·세탁 중 409), 추천은 고른 옷만 가능하고 추천 기준을 화면에 표시 ② 옷 등록에 '보관 위치' 선택 칸(GarmentInput.spaceId) ③ 색상 입력을 팔레트+직접 고르기(스포이드)+확인/취소로 바꾸고, 색만 고르면 가까운 색 이름 자동 입력(상세 '미입력' 해소). 백엔드 테스트 1개 추가, 프런트 lint·build 통과
- 2026-10-29 범위 변경 발견(팀원 커밋 6cdebd3·318f47e·ee85b50, 우성 수정안): 문제를 '집 밖·박스 속 옷의 위치·상태 모름'으로 좁힘. 해법 chosen = 박스·세탁소 '옮기는 단위' 묶음 기록, 3D 가상착의·코디 rejected, features에서 R05·R06 제외, R11(묶음 기록) 추가
  - 학생이 이 세션에서 준 기획안(택 인식+통합 기록 chosen, 3D deferred)은 수정 전 버전으로 보임
  - 수정안 기준이면: R11 미구현(QR·영수증 촬영, 여러 벌 묶어 옮김, 박스·본가 위치), R04 '집 밖/박스' 보기 없음, scenarios.yaml S4·S5(3D·추천)가 제외 기능을 씀 → 흐름 교체 필요, 3D·추천 화면을 숨길지 결정 필요
  - 학생 결정(2026-10-29): 수정안 기준으로 진행
  - R11 구현(2026-10-29): '옮기기' 화면(/move, 메뉴의 '코디 스튜디오' 자리. /studio 주소는 남김)에서 박스·집 밖·세탁소로 여러 벌을 한 번에 기록. 보낼 곳·세탁소·회수 간격은 박스 라벨 QR 또는 가장 최근 묶음으로 미리 채우고 날짜는 오늘이 기본, 옷만 체크하면 저장. 라벨·영수증 사진은 묶음에 남음(최대 4장). 처음 보는 옷은 사진+이름+종류로 바로 등록해 묶음에 넣음. 박스 공간 카드에 인쇄용 QR 라벨(/move?to={공간ID}), 브라우저가 BarcodeDetector를 지원하면 라벨 사진에서 QR을 읽고 아니면 박스를 직접 고름. 세탁소 묶음은 옷마다 세탁 기록을 만들어 관리함(R08) 회수 관리로 이어짐
  - 백엔드: 공간 유형 BOX(박스)·OFFSITE(집 밖) 추가, V2 마이그레이션(move_batches 외 4개 테이블·같은 주인 트리거 8개), GET/POST /api/moves, 옷 요약에 locationKind(집 안·박스 속·집 밖·세탁·수선 맡김·미배치), 배치 추천은 집 밖을 고르지 않고 장기 보관 옷은 박스도 후보. CI의 스키마 비교가 V1+V2를 합쳐 비교하도록 수정. 시드에 여름 박스·본가와 옷 4벌 추가
  - R04: 보기 기준에 '집 밖/박스'(박스 속·집 밖·세탁 맡김을 먼저), 카드 위치 줄에 '박스 속 · 여름 박스'처럼 표시
  - scenarios.yaml S4·S5를 R11 흐름(박스로 묶어 옮기기, 세탁소 묶음 맡기기)으로 교체, ERD.md에 2.1절 추가
  - 검사: 프런트 lint·build 통과. 백엔드 통합 테스트 1개 추가(박스·집 밖·세탁소 묶음, 409·400·404) — 로컬에 JDK 21·MariaDB가 없어 CI 결과로 확인
  - 남은 것: 영수증 글자 읽기(업체·날짜 자동 입력)는 하지 않음(직접 입력·최근값 기본), features 문서의 R05·R06 화면(/studio)을 지울지 팀 결정
  - R11 main 반영 720f44a
  - 운영 미완: 배포 URL 없음, AI 키 연결 실요청 미확인(S2 E2E도 키 필요). e2e/·workflows/scenarios.yml은 추가함(6장)
- 2026-10-29 학생 결정: 백엔드 Spring, DB MariaDB, 프런트 Vite+React. DB는 5NF까지 정규화하고 ER 다이어그램과 교차 검증 결과를 제공(docs/db/ERD.md). 이 PC에 Docker 없음 → docker 검증은 GitHub Actions로
- 로컬 테스트용 일회용 MariaDB 10.4 인스턴스: 127.0.0.1:3399(root, 비밀번호 없음, 데이터는 세션 scratchpad). 학생 PC의 MariaDB 서비스(3307)는 건드리지 않음
- 학생에게 확인할 내용: 팀원 실제 경험(experiences E1 when/workaround/quote 학생 답 대기), sources(학생 요청 시 검색), S2용 실제 택 사진 2장(e2e/fixtures)
- 2026-10-29 결정(학생 지시): 기획 내용은 학생이 제공한 캔버스 PDF·서비스 구체화 md에서 그대로 옮김. R02 제품 검색은 AI Gateway 검색·수집 도구로 실제 구현 유지(학생: "API 키 있음, 크롤링해서 해도 됨"). platform both, 로그인 있음·역할 '사용자', R03은 md 기준 유지(브라우저 배경 제거 + 실패 시 원본) — md의 권고안을 학생이 "계획서 작성" 지시로 채택, 이견 시 수정

## 1. GitHub 준비

- [x] 기존 저장소·브랜치·remote와 로그인 확인 (gh 설치, Hostfs 로그인)
- [x] 학생과 저장소 이름 합의 (답을 받기 전에는 생성하지 않음) → 학생이 기존 레포 SUMTECH_CodeName 지정
- [x] 팀의 private 레포 생성 또는 기존 레포 확인 → 기존 레포, 학생이 PRIVATE로 전환함
- [x] loopthon-bot 앱을 팀 레포에 설치 (https://github.com/apps/loopthon-bot/installations/new, 팀 레포만 선택)
- [x] 팀 코드로 대시보드 API 로그인(`data.teamId`), 레포 URL을 HTTP로 저장(`data.team.repoUrl`) 확인. 팀 코드로는 화면에 들어갈 수 없음
- [x] 사이트에 등록한 레포를 실제 작업 폴더로 clone, remote·기본 브랜치 확인 (빈 레포, main으로 첫 push)
- [x] .gitignore / .env.example / README 준비(`.env`·`node_modules/`·`.next/`·`dist/`·`build/` 제외, 큰 데이터 파일 커밋 안 함. 파일이 너무 많으면 저장소를 읽지 못함)
- [x] 준비 파일 commit/push 확인
- [x] 앱 설치 후 읽기 권한 확인 (5분 자동 재확인, 즉시 확인은 같은 레포 URL 다시 저장)
- 저장소 URL / 기본 브랜치 / commit SHA: https://github.com/Hostfs/SUMTECH_CodeName / main / 첫 commit 06bd30bf5927bde274a477123751f9e504f7873e
- 사이트 등록 결과 / loopthon-bot 설치·접근 상태: 2026-10-29 팀 11에 repoUrl 저장 성공, check.result=denied (앱 미설치) → 설치 후 재저장 check.result=ok, repoAccessOk=true

## 2. 문제정의 기록 → 문제 다지기 → 해법 찾기 → 기능 명세

- [x] 종이 기록 수령(학생이 채팅에 옮겨 적거나 사진 첨부) → 캔버스 기입본 PDF·서비스 구체화 md
- [x] problem.example.yaml을 참고해 docs/problem.yaml 작성 (R00~R10, YAML 파서 확인)
- [x] docs/scenarios.yaml S1~S8 작성 (YAML 파서·키·길이 확인), README 구현 설계 작성
- [ ] 원문 의도와 불명확한 내용 확인, 없는 근거는 빈칸 유지
- [ ] 2-A 문제 다지기: 캔버스 칸을 질문으로 다짐(Agent가 해법·후보·예시 답을 먼저 내지 않음, 학생 답이 없는 칸은 "학생 답 대기")
- [ ] 팀원 경험을 언제·어떤 장면·어떻게 대응했는지까지 experiences에 기록
- [ ] 외부 자료는 열리는 URL을 sources에 그대로 적고 원문이 주장을 직접 뒷받침하는지 확인, 출처 없는 수치 없음
- [ ] 문제가 '우리 기능이 없어서'가 아니라 실제 상황·행동으로 서술됐는지 확인
- [ ] 2-B 해법 찾기: 학생이 낸 해법과 결정을 solution_paths에, 기존 대안 대신 이 해법이어야 하는 이유를 학생 말로 why_ours에 작성
- [ ] 2-C features에 학생이 고른 해법의 기능별 입력·결과·완료 조건 작성
- [ ] YAML 문법 검사, 등록된 레포의 기본 브랜치에 docs/problem.yaml push
- [ ] 학생이 개인 로그인으로 우리 팀 → 문제 정의를 열어 캔버스 표시 확인(Agent는 화면을 열 수 없음, 약 1분 캐시)
- [ ] 핵심 사용자 흐름·기능별 동작 규칙·완료 조건·제외 범위를 팀과 확인
- [ ] 로그인 필요 여부와 역할 이름(흐름 account·docker 시드 계정 역할 이름으로 씀) 결정
- [ ] 첫 화면에서 알려 줄 것(로그인하지 않은 사람이 `/`에서 볼 서비스 이름·하는 일)을 학생과 정함
- [ ] 주 사용 플랫폼(desktop·mobile·both)과 실제 사용 장면에 근거한 platformReason 작성
- [ ] 사용자 핵심 흐름 3~8개를 scenarios.example.yaml 참고해 docs/scenarios.yaml에 작성(steps는 화면의 메뉴·버튼 이름으로 한 줄에 한 동작, 로그인 흐름은 account 지정), YAML 파서로 형식 확인 후 기본 브랜치 push
- [ ] 서비스의 AI 호출 필요 여부 확인
- [ ] README 등 기존 문서에 확인된 구현 설계 기록, 기본 브랜치 push
- 문제정의·구현 설계 링크 / commit SHA / 확인할 빈칸:

## 3. 최소 화면 docker 실행·CI·첫 배포

- [x] 설계에 맞는 최소 화면과 서버 실행 구성 준비, Dockerfile 작성(빌드는 Dockerfile에서 끝내고 시작 명령은 서버 실행만)
- [x] docker-compose.example.yml을 docker-compose.yml로 복사: app·db, app만 ports "3000:3000", 앱은 컨테이너 안 3000에서 받음, 앱 설정에 localhost:3000 같은 절대 주소 없음 (키트 예시 파일은 이 PC에 없어 규칙대로 직접 작성)
- [x] app 말고는 ports·container_name이 없고, 어느 서비스에도 env_file 없음
- [x] 환경변수 이름 그대로(RELEASE_ID·SEED_USER_*·AI_GATEWAY_API_KEY), 시드 계정 값은 `${}` 없이 직접 적음
- [x] 빈 DB에서 `docker compose up --build`만으로 앱·시드 데이터가 2분 안에 뜸 → 2026-10-29 이 PC Docker Desktop에서 확인: 이미지 빌드 포함 168초(첫 빌드), DB healthy 후 앱 기동 약 6초, V1·V2 마이그레이션·시드 생성 로그 확인
- [x] README 설치·빌드·실행 안내와 환경변수 표(이름·용도·설정 위치)
- [x] GET /__health가 인증·리다이렉트 없이 200 응답(docker 앱에서 `{"releaseId":"dev"}` 확인, 배포는 미확인), 실제 배포 commit을 releaseId로 제공
- [ ] 공개 HTTPS URL 첫 배포(발표용, 배포용 DB는 학생 확인 후 무료 등급)
- [ ] CI 실제 검사(workflows/scenarios.yml 복사)와 성공 뒤 자동 배포 연결, 실제 push로 확인 → `.github/workflows/scenarios.yml` 직접 작성(키트 원본 없음): 빈 DB compose 기동 → /__health의 releaseId=commit 확인 → Playwright PC·휴대폰. 자동 배포는 배포처가 정해지지 않아 미연결
- [ ] Agent가 대시보드 배포 URL 저장, UP·배포 commit 일치 확인
- 배포 URL / CI·배포 링크 / 첫 배포 commit SHA:

## 4. 서비스 AI API 설정 (필요할 때만)

- 해당 여부 / 선택한 Gateway 지원 모델:
- [ ] 모든 지원 모델을 자유롭게 사용하며 권장 목록은 추천용임을 확인
- [ ] 팀 전체 누적 $10 한도와 현재 사용액·남은 예산·선택 모델 단가 확인
- [ ] 학생이 자료 → API 키에서 키가 없으면 직접 발급 후 복사, Agent는 키를 발급·조회하지 않음
- [ ] 서버가 환경변수 AI_GATEWAY_API_KEY에서 키를 읽음(주최 측 실행도 이 이름으로 키를 넣음), docker-compose.yml app에 `AI_GATEWAY_API_KEY: ${AI_GATEWAY_API_KEY:-}`
- [ ] 학생이 AI_GATEWAY_API_KEY를 로컬·배포 환경과 GitHub Secrets에 직접 설정, .env.example에는 이름만 기록
- [ ] 서버에서 Gateway 호출, 접근 제한·예산 부족·지연·실패 처리
- [ ] 팀 예산 안의 작은 실제 요청으로 연결 확인
- 키 값을 제외한 설정·연결 확인 결과 / 준비 대기 사항:

## 5. 핵심 기능 구현

- [ ] (로그인이 있으면) 회원가입·로그인·로그아웃·역할별 권한 검사 구현, 아이디/비밀번호로 바로 로그인 가능
- [ ] 로그인하지 않은 사람이 `/`를 열면 서비스 이름과 하는 일이 보임(`/`를 로그인 화면으로 보내거나 로그인 칸만 두지 않음)
- [ ] 핵심 입력 → 실제 처리 → 결과 → 다음 행동 구현
- [ ] features의 동작 규칙·완료 조건과 대조, 새 기능은 features에 먼저 추가
- [ ] 화면 다듬기(문구·배치·빈 화면 안내·시각)는 학생이 정한 방향 안에서 Agent가 만들어 보여 주고 학생이 고름
- [ ] docs/scenarios.yaml의 메뉴·버튼 이름이 실제 화면과 같은지 확인, 화면 이름을 바꾸면 흐름·spec도 같은 commit에서 수정
- [ ] 로그인 전에는 로그인 필요 화면이 열리지 않음, 없는 주소는 404(500 아님), 주 사용 플랫폼 화면 폭에서 깨지지 않음
- [ ] 실패 처리와 의미 있는 테스트, 실행한 검사 결과 기록
- [ ] 의미 있는 변경 commit/push, CI·자동 배포 결과 확인
- 완료한 과업 / 검사 결과 / 남은 구현:

## 6. 흐름 E2E

- [x] 키트 e2e/를 저장소 e2e/로 복사, platform에 맞는 project만 남김 → 키트 원본을 이 PC에서 찾지 못해 규칙대로 직접 작성(Playwright 1.63.0, project desktop·mobile). 키트를 받으면 config를 키트 것으로 맞출 것
- [x] 흐름마다 e2e/scenarios/<id>.spec.ts 하나(id와 같은 파일 이름), 파일마다 test 하나
- [x] steps를 같은 순서의 화면 조작으로 spec 본문에 옮김(API 호출 없음), 회원가입 이메일은 실행마다 다르게
- [x] page.goto는 창마다 처음 한 번만(로그인 화면으로 가는 goto만 예외), 회원가입은 첫 화면에서 눌러 감, 도우미 함수는 test보다 위에
- [x] 마지막에 expected 결과를 expect로 확인
- [x] test.skip·test.fixme·test.only·조건부 return·실패를 삼키는 try/catch 없음
- [x] page.route·route.fulfill·routeFromHAR·routeWebSocket·addInitScript·화면 글자를 바꾸는 page.evaluate 없음(S6에서 선택된 추천 공간 이름을 읽기만 함)
- [x] 선행 데이터는 앱 시드로(로그인 때 시드 초기화), 업로드 자료는 e2e/fixtures/(화면에서 그린 예시 택 2장 — 실제 택 사진으로 바꾸면 더 좋음)
- [ ] AI 기능은 실제 응답을 기다려 확인, 흐름 하나가 로컬에서 1분 안 → S2는 AI_GATEWAY_API_KEY가 있어야 함(이 PC 환경에 키 없음, 학생이 설정)
- [x] viewport를 spec에서 바꾸지 않음, platform both → PC·휴대폰 두 화면에서 실행
- [x] globalSetup·storageState 등에 기대지 않음(workers 1만 설정: 같은 시드 계정을 쓰므로)
- [ ] `docker compose down -v`, `docker compose up -d --build` 뒤 `npx playwright test`로 모든 흐름 통과 → S2 제외 통과
- 흐름별 E2E 결과(2026-10-29, 이 PC docker, 빈 DB): S1·S3·S4·S5·S6·S7·S8 desktop·mobile 14/14 통과(25초). S2는 AI 키 없음 → '택 분석하기' 뒤 '택을 읽었어요'를 기다리다 실패(사진 2장 올리기까지 통과)
- 발견해 고친 것: 휴대폰 화면에 로그인한 계정·로그아웃이 없었음 → 화면 위 계정 줄 추가(S1 기대 결과). S5·S7 steps에 "'진행 중' 탭을 누른다" 추가(관리함은 기한 지남 탭이 먼저 열림)
- 백엔드 통합 테스트: 2026-10-29 docker(maven:3.9-temurin-21 + mariadb:11.4)에서 `mvn test` 통과(R03·배치 수정·R11 테스트 포함)

## 7. 최종 검증

- [ ] 실제 배포에서 인증·핵심 과업·대표 실패 동작과 환경변수 확인
- [ ] 빈 DB의 docker 앱에서 platform 화면으로 모든 흐름 E2E 통과, spec이 steps·expected 그대로인지 다시 읽음, 프로젝트 검사, 비밀값 노출 확인
- [ ] 최종 기본 브랜치 push, 해당 commit의 CI 성공·자동 배포 확인
- [ ] 같은 배포 URL을 다시 저장해 대시보드 UP·최종 배포 commit 일치 확인
- [ ] 학생이 자료 → 제출 요건 화면에서 노란 줄이 없다고 확인
- [ ] 문제정의·구현 설계·최종 결과 링크와 미확인 사항 보고
- 검사 결과 / CI·배포 링크 / 최종 commit SHA:
- 흐름별 E2E 결과(통과 / 실패 단계와 이유):
- 배포 URL:
- 아직 못 한 일 / 제한 / 다음 행동:
