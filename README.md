# 옷결 — 택에서 시작해 코디·보관 위치·관리 상태까지 연결하는 AI 옷장

옷의 택을 촬영하면 AI가 제품 정보와 세탁법을 읽어 디지털 옷장을 만들고, 코디 미리보기·실물 보관 위치·세탁 및 수선 상태까지 한 벌의 기록으로 연결하는 웹 서비스입니다.

> 택을 찍어 등록하고, 입을 조합을 고른 뒤, 어디서 꺼낼지까지 확인하는 내 옷 관리 서비스.

## 문서

| 문서 | 내용 |
| --- | --- |
| [`docs/problem.yaml`](docs/problem.yaml) | 문제정의 캔버스, 5 Whys, 해법 경로, 통찰, 기능 명세(R00~R10) |
| [`docs/scenarios.yaml`](docs/scenarios.yaml) | 사용자 핵심 흐름 S1~S8과 주 사용 플랫폼 |
| [`docs/db/schema.sql`](docs/db/schema.sql) | DB 스키마(5NF, MariaDB). 앱의 Flyway 마이그레이션과 같은 파일 |
| [`docs/db/ERD.md`](docs/db/ERD.md) | ER 다이어그램, 정규화 단계별 근거, 교차 검증 결과(`ERD.html`은 브라우저용) |
| 아래 「구현 설계」 | 기능별 저장 정보·권한·실패 규칙, 데이터 구조, 구현 순서 |
| `progress.md` | 팀 진행 기록 |

---

## 구현 설계

### 1. 누가, 어떤 장면에서 쓰는가

- **대상**: 계절별 옷을 옷장·서랍·보관 박스에 나누어 두고, 외출 준비와 세탁·수선을 스스로 관리하는 대학생·사회초년생(`problem.yaml` P1).
- **사용 장면**: 새 옷 구매 직후 등록, 계절 옷 교체 때 배치, 외출 전 코디와 옷 찾기, 세탁·수선 접수와 회수.
- **점진적 시작**: 처음부터 모든 옷을 꺼낼 필요 없이 새 옷·오늘 입은 옷·계절 교체 때 꺼낸 옷부터 한 벌씩 등록한다.

### 2. 핵심 흐름 (시작 상태 → 입력 → 처리 → 결과 → 다음 행동)

| 단계 | 시작 상태 | 입력/행동 | 처리 | 결과 | 다음 행동 |
| --- | --- | --- | --- | --- | --- |
| 등록 | 새 옷이 있고 기록이 없음 | 택 사진 1장 이상 | AI 비전으로 택 구조화 → 웹 검색·상품 페이지 수집으로 제품 후보 | 추출값·원문·확인 필요 표시, 후보 카드 | 값 수정·후보 확정·저장 |
| 분류 | 옷이 저장됨 | 보기 기준·검색어·분류 수정 | 속성별 묶기, 사용자 수정값 우선 | 계절·브랜드·종류·위치·상태별 목록 | 옷 선택 → 코디·위치·관리 |
| 코디 | 상하의가 있음 | 신체 치수, 상하의 선택 또는 AI 추천 요청 | 치수로 모형 비율 조정, 템플릿에 색·길이 반영 / 사용 가능 의류만으로 추천 | 3D 미리보기, 추천 조합과 이유 | 코디 저장, 옷 위치 확인 |
| 배치 | 공간과 미배치 옷이 있음 | 공간 등록, 배치 추천 요청 | 종류·계절·자주 입는 정도·공간 유형·용량 규칙 | 미확정 추천안, 용량 초과 표시 | '배치 완료'로 위치 확정 → 검색 시 경로 |
| 관리 | 옷이 보관 중 | 세탁·수선 맡기기, 회수 예정일 | 상태 전환·이력 기록, 접속 시점 기준 예정·기한 지남 계산 | 관리함 목록·배지, 추천 제외 | 회수 완료 → 재배치 확인 |

### 3. 기능별 동작 규칙

| ID | 저장할 정보 | 읽기·변경 권한 | 잘못된 입력·실패 시 |
| --- | --- | --- | --- |
| R00 | 사용자(이메일, 비밀번호 해시), 세션 | 본인만 | 이메일 형식 오류·중복·짧은 비밀번호(8자 미만)는 가입 거부와 이유 표시. 로그인 실패는 이유 표시 |
| R01 | `LabelExtraction`: 원본 택 사진, 원문, 추출값, 판독 여부, 사용자 정정값 | 소유자만 | 이미지가 아니거나 10MB 초과면 거부. AI 실패·키 없음·예산 부족은 입력 유지, '다시 분석'과 '직접 입력' 제공. 읽지 못한 값은 '확인 필요' |
| R02 | `ProductCandidate`: 상품명, 이미지 URL, 색상, 출처 URL, 조회 시점, 일치 근거, 확정 여부 | 소유자만 | 결과 없음·차단·시간 초과(20초)는 '검색 결과 없음'과 '직접 입력으로 계속'. 페이지 내용 속 지시문은 데이터로만 취급 |
| R03 | `ImageAsset`: 원본, 정리본, 출처, 처리 상태 | 소유자만 | 처리 실패 시 원본을 대표 이미지로 유지, '다시 처리' 제공. 로고·무늬·색을 생성·변경하지 않음 |
| R04 | `garments`(세부 종류에서 종류 계산), `garment_seasons`, `garment_collections`, `garment_materials`(부위·섬유·혼용률), `garment_care_instructions`, `garment_ai_fields` | 소유자만 | 옷 이름이 비면 저장 거부. 부위별 혼용률 합계가 100%가 아니면 거부. 사용자 수정값은 AI 재분석으로 덮어쓰지 않음. 같은 품번은 중복 후보 안내만, 자동 병합 안 함 |
| R05 | `BodyProfile`(cm, 비워 둘 수 있음), `Outfit`(상의 ID, 하의 ID, 이름) | 소유자만, 신체 치수는 삭제 가능 | 범위 밖 치수(예 키 100~230cm 밖)는 거부. 템플릿이 없는 종류는 '3D 미지원' 표시 후 2D 카드로 보여 줌 |
| R06 | 추천 요청 조건과 결과(의류 ID, 이유) | 소유자만 | 사용 불가 옷과 존재하지 않는 ID는 결과에서 제거. 조합이 불가능하면 이유 안내. AI 실패 시 재시도 |
| R07 | `storage_spaces`, `storage_space_parents`(계층), `placement_proposals`(미확정 추천), `garment_placements`(확정 위치) | 소유자만 | 이름이 비거나 용량이 1 미만이면 거부. 용량 초과는 초과 수량 표시. 추천만으로 현재 위치 변경 안 함. 안쪽 공간이나 옷이 있는 공간은 삭제 거부 |
| R08 | `care_events`(종류, 자택/업체, 업체명, 내용, 맡긴 날, 예정일, 회수 시각) | 소유자만 | 예정일이 맡긴 날보다 앞서면 거부. 진행 중 기록은 한 벌에 하나. 세탁 중·수선 중·회수 후 위치 미확인은 저장하지 않고 이 기록에서 계산해 모든 화면이 같은 값을 읽음 |
| R09 | 위 모든 기록이 같은 `garments.id`를 참조 | 서버에서 소유권 검사 + DB 트리거로 같은 주인 강제 | 다른 계정 자료 접근은 404 |
| R10 | — | — | 없는 주소는 404 화면. 외부 호출은 시간 제한과 재시도 1회, 실패 시 입력 유지 |

**의류 상태 값**: 보관 중, 착용·보관 전, 세탁 대기, 세탁 중, 수선 중, 회수 완료·위치 미확인. 앞의 셋은 사용자가 정해 저장하고, 뒤의 셋은 세탁·수선 기록과 위치 확정 시각에서 계산한다(`docs/db/ERD.md` 5절). 코디 추천 기본 후보는 보관 중, 회수 완료·위치 미확인, 그리고 사용자가 사용 가능으로 지정한 착용·보관 전이다.

### 4. 기능별 완료 조건

`docs/problem.yaml`의 `features[].done`이 기준이다. 요약하면:

- **R01** 택 사진 2장을 한 의류에 묶어 분석하고, 고친 값과 택 사진이 옷 상세에 남는다.
- **R02** 후보를 선택하면 상품명·출처·조회 시점이 남고, 실패해도 '직접 입력으로 계속'으로 등록을 마친다.
- **R04** 계절·브랜드·종류 보기로 바꿀 수 있고, 수정값이 새로고침 후에도 유지된다.
- **R05** 치수 변경·회전·확대·4종 템플릿 교체가 작동하고, 저장한 코디가 다시 열린다.
- **R06** 실제로 있고 사용 가능한 옷만 추천하고 이유를 보여 준다.
- **R07** 추천은 미확정으로 남고, '배치 완료' 후에야 위치 검색 결과가 바뀐다.
- **R08** 예정일 변경, 기한 지남 표시, 회수 완료, 재배치 확인이 작동한다.
- **R09** 상태 변경이 옷장·상세·지도·추천에 같은 값으로 보인다.

### 5. 로그인과 역할

- 로그인이 있다. 옷장은 계정별로 서버에 저장되고, 같은 계정으로 다른 기기에서도 이어서 쓴다.
- 역할은 **`사용자`** 하나다. 사용자는 자기 옷장만 읽고 바꾼다.
- 로그인 방식은 이메일과 비밀번호이고, 세션은 HttpOnly 쿠키로 관리한다.
- docker 시드 계정 `student@example.com`이 `사용자` 역할이다. 이 계정에는 흐름에 필요한 선행 데이터를 넣는다.

### 6. 첫 화면 (`/`, 로그인 전)

- 서비스 이름 **옷결**과 한 줄 소개("택을 찍어 등록하고, 입을 조합을 고른 뒤, 어디서 꺼낼지까지")를 보여 준다.
- 등록 → 코디 → 위치 → 관리, 네 단계를 한눈에 보이게 소개한다.
- '시작하기'(회원가입)와 '로그인' 버튼을 둔다.
- 첫 화면을 로그인 화면으로 보내지 않는다.

### 7. 주 사용 플랫폼

`both`(휴대폰과 PC). 촬영·옷 찾기·회수 확인은 휴대폰에서, 배치 계획과 3D 비교는 PC에서 한다(`docs/scenarios.yaml`의 `platformReason`). 휴대폰 화면은 하단 탭 메뉴, PC 화면은 좌측 메뉴를 쓰고, 메뉴 이름은 같게 둔다.

### 8. 화면 구성

| 화면 | 메뉴 이름 | 하는 일 |
| --- | --- | --- |
| 내 옷장 | `내 옷장` | 보기 기준 변경, 검색, 옷 카드(대표 이미지·이름·상태·위치) |
| 옷 등록 | `옷 등록` | 택 사진 추가 → 택 분석하기 → 값 확인·수정 → 제품 찾기 → 저장하기 |
| 옷 상세 | (카드 선택) | 정보 수정, 택·이미지, 세탁법, 위치, 세탁·수선 맡기기, 관리 이력 |
| 코디 스튜디오 | `코디 스튜디오` | 신체 치수, 3D 모형, 상하의 선택, 코디 저장, AI 추천 탭 |
| 옷장 지도 | `옷장 지도` | 공간 추가, 공간별 옷·용량, 미배치 목록, 배치 추천 받기 |
| 관리함 | `관리함` | 오늘 회수 예정, 기한 지남, 진행 중, 완료 이력 |

상태는 색만으로 구분하지 않고 문구와 아이콘을 함께 쓴다.

### 9. AI·외부 서비스 사용

서비스에서 AI를 사용한다. 모든 호출은 서버에서 `AI_GATEWAY_API_KEY`로 Vercel AI Gateway를 거친다(팀 전체 $10 한도).

| 용도 | 방식 | 비용 관리 |
| --- | --- | --- |
| 택 구조화(R01) | 비전 지원 모델에 택 사진을 보내 정해진 JSON 스키마로 추출 | 이미지 긴 변 1600px로 축소, 같은 이미지 해시는 캐시 |
| 제품 후보 검색(R02) | Gateway 검색 도구(`perplexitySearch` 또는 `exaSearch`)로 '브랜드 + 품번' 검색 → `browserbaseFetch`로 후보 페이지 수집 → 모델이 상품명·이미지·색상 구조화 | 후보 최대 3개, 같은 품번 캐시, 시간 제한 20초 |
| 분류 제안·코디 추천(R04·R06) | 저가 텍스트 모델에 의류 ID와 속성 목록을 보내 JSON으로 응답받음 | 출력 길이 제한, 재시도 1회 |

모델은 Gateway 모델 목록(`https://ai-gateway.vercel.sh/v1/models`)에서 확인한 `google/gemini-2.5-flash`를 기본으로 쓰고 `AI_MODEL`로 바꿀 수 있다. 제품 검색이 연 후보 주소는 공인 http(s) 주소만 열고(내부망·루프백 차단), 리다이렉트도 같은 검사를 거쳐 3번까지만 따라간다. 키가 없거나 예산이 다 떨어지면 AI 기능만 실패 안내를 보여 주고, 직접 입력 경로로 계속 쓸 수 있다. 예시 데이터를 실시간 AI 결과처럼 보여 주지 않는다.

### 10. 기술 구성

| 계층 | 선택 |
| --- | --- |
| 백엔드 | Spring Boot 4.1(Java 21): REST API(`/api/**`), 세션 쿠키 로그인(Spring Security), Bean Validation |
| DB | MariaDB(docker는 `mariadb:11.4`, 로컬 개발은 PC의 MariaDB 10.4) + Flyway. 마이그레이션 `V1__init.sql`은 `docs/db/schema.sql`과 같은 파일(CI가 비교) |
| 프런트엔드 | Vite + React(TypeScript), 반응형. 빌드 결과를 Spring이 같은 주소에서 제공한다(app 컨테이너 하나, 3000 포트) |
| 3D | Three.js(@react-three/fiber): 기본 도형으로 만든 회색 신체모형과 반소매·긴소매·재킷·긴바지 템플릿 |
| 파일 | 업로드 이미지는 DB(`images.data`, 한 장 10MB 이하)에 저장 |
| 이미지 정리 | 브라우저 안 배경 제거 라이브러리 + 정사각 캔버스 정렬, 실패 시 원본 유지 |
| AI | 서버에서 Vercel AI Gateway HTTP API 호출(`AI_GATEWAY_API_KEY`) |
| 테스트 | 백엔드 통합 테스트(JUnit, 실제 MariaDB: 로컬 인스턴스·CI의 `mariadb:11.4`), DB 도메인 값과 코드 일치 검사, Playwright E2E(`e2e/`), GitHub Actions |
| 배포 | 컨테이너 배포(Spring은 Vercel에서 실행되지 않음), `/__health`에서 실제 배포 commit SHA 응답 |

#### API 요약

| 경로 | 기능 |
| --- | --- |
| `POST /api/auth/signup`·`login`·`logout`, `GET /api/auth/me` | R00 회원가입·로그인 |
| `GET/POST /api/garments`, `GET/PUT/DELETE /api/garments/{id}` | R04·R09 옷 목록(검색 `q`)·상세·등록·수정 |
| `PATCH /api/garments/{id}/status`, `POST /api/garments/{id}/confirm-placement` | 상태 변경, 위치 확정(재배치 확인) |
| `POST /api/images`, `GET /api/images/{id}` | 사진 업로드·조회(본인만). 사진은 옷을 저장할 때 그 옷에 연결됨 |
| `GET/POST/PUT/DELETE /api/spaces` | R07 옷장 지도·공간 |
| `POST /api/placements/recommend`, `PUT /api/placements/{id}`, `POST /api/placements/{id}/apply` | R07 배치 추천(미확정)·수정·배치 완료 |
| `GET /api/care`, `POST /api/garments/{id}/care`, `PATCH /api/care/{id}`, `POST /api/care/{id}/complete` | R08 관리함·맡기기·예정일 변경·회수 완료 |
| `GET/PUT/DELETE /api/body`, `GET/POST/DELETE /api/outfits` | R05 신체 치수·코디 저장 |
| `GET /api/meta` | 선택지와 한국어 표시 이름(DB 도메인 테이블을 그대로 읽음) |
| `POST /api/labels/analyze` | R01 택 사진 1~4장 저장 → 비전 모델로 판독, 항목별 판독값과 '확인 필요' 저장. 실패해도 판독 기록이 남고 직접 입력으로 계속 |
| `POST /api/products/search` | R02 웹 검색(Gateway `vercel:perplexity_search`) → 후보 페이지를 서버가 직접 열어 실제로 열리는 페이지만 후보로 저장, 이름·이미지는 페이지의 og 정보 우선 |
| `POST /api/recommendations` | R06 지금 입을 수 있는 옷 목록만 모델에 보내고, 목록에 없는 ID·역할이 맞지 않는 조합은 버림 |
| `GET /__health` | 배포 상태(`releaseId`) |

### 11. 데이터 모델

5NF까지 정규화한 46개 테이블(핵심 29 + 도메인 17)이다. 전체 다이어그램과 단계별 근거는 [`docs/db/ERD.md`](docs/db/ERD.md)에 있다.

- 개체: `users`, `garments`, `storage_spaces`, `collections`, `images`, `label_extractions`, `product_searches`, `product_candidates`, `care_events`, `placement_proposals`, `outfits`, `body_profiles`
- 연결: 확정 위치 `garment_placements`, 공간 계층 `storage_space_parents`, 이미지 `garment_images`·`garment_cover_images`·`image_processings`, 택 판독 `label_extraction_images`·`label_extraction_values`·`garment_label_extractions`, 제품 `label_extraction_searches`·`garment_products`, 코디 `outfit_garments`
- 다치 속성: `garment_seasons`, `garment_collections`, `garment_ai_fields`, `garment_materials`, `garment_care_instructions`, `garment_measurements`
- 무결성: 코드 값은 도메인 테이블 FK, 값 범위는 CHECK, 같은 주인 규칙은 트리거 22개, 진행 중 세탁·수선 1건은 생성 열 + UNIQUE

### 12. 시드 데이터 (docker 첫 기동 시)

`사용자` 시드 계정에 들어가는 데이터:

- **의류 11벌**(소재·총장 포함): 네이비 옥스퍼드 셔츠, 화이트 반소매 티셔츠, 그레이 울 재킷, 블랙 슬랙스, 연청 데님 팬츠(미배치), 베이지 니트(세탁 중, 예정일 어제 → 기한 지남), 카키 치노 팬츠(수선 중, 예정일 오늘), 묶음 기록(S4·S5)용 린넨 반소매 셔츠·네이비 반바지·체크 플란넬 셔츠·그레이 후드티
- **공간 8곳**: 옷장 A > 왼쪽 행거, 서랍장 > 2단, 침대 아래 > 겨울 박스, 여름 박스(박스), 본가(집 밖)
- 시드 계정으로 다시 로그인하면 시드 데이터가 처음 상태로 돌아간다(흐름마다 같은 시작 상태)

날짜는 기동 시점을 기준으로 계산한다.

### 13. 구현 순서와 일정 (마감 10/30 12:00)

통합 우선순위는 기획서를 따른다. 등록·저장(R01·R02·R04·R09)을 먼저 하고, 위치·상태(R07·R08)를 잇고, 이미지·3D·추천(R03·R05·R06)을 붙인다.

| 시간 | 작업 | 확인 |
| --- | --- | --- |
| 10/29 17:00~19:00 | 문서 push, Spring·MariaDB 백엔드·`/__health`·Dockerfile·compose·CI, 첫 배포, 대시보드 등록 | CI 통과, UP 표시 |
| 20:00~22:00 | R00 인증, R09 데이터 모델·시드, R04 내 옷장·옷 상세·분류 수정 | S1·S3 |
| 22:00~01:00 | R01 택 분석, R02 제품 검색·확정·대체 등록 | S2 |
| 01:00~03:00 | R07 옷장 지도·배치, R08 관리함 | S6·S7·S8 |
| 03:00~06:00 | R05 3D 코디, R06 AI 추천, R03 이미지 정리 | S4·S5 |
| 06:00~09:00 | S1~S8 E2E를 휴대폰·PC 화면 모두에서 통과, 오류 처리 | CI scenarios |
| 09:00~11:00 | 화면 다듬기, 택 인식 실제 측정(정오 기록) | 발표 자료용 수치 |
| 11:00~12:00 | 기능 추가 중단, 최종 검증·제출 요건 확인 | 대시보드 UP·버전 일치 |

시간이 부족하면 기획서 11장에 따라 지원 브랜드 수, 3D 템플릿의 디테일, 추천 후보 수, 화면 장식부터 줄인다. 기능 자체를 빼야 하면 `docs/problem.yaml`을 먼저 고친다.

### 14. 이번 범위에서 제외·보류

- 정밀 패턴·물성 기반 가상착의, 모든 옷 종류의 3D 지원
- 무제한 브랜드 검색 보장, 세탁소 시스템 연동
- 실물 자동 추적, 브라우저가 닫힌 동안의 푸시·문자·이메일 알림
- 날씨·쇼핑 추천

### 15. 아직 확인하지 못한 가정

- 실제 사용자 관찰·인터뷰, 소요 시간과 빈도(`problem.yaml` E1은 제안자의 문제 제기뿐이다)
- 택 인식 정확도와 제품 검색 성공률: 시연 전에 팀 소유 의류 택으로 측정해 표본과 함께 보고한다
- 브랜드 사이트의 상품 이미지를 저장·가공·전시할 수 있는 범위: 제한되면 사용자 촬영 사진을 쓴다
- 3D 미리보기가 코디 선택에 도움이 되는지

---

## 설치·실행

```bash
docker compose up --build        # app(Spring + 화면) + MariaDB + 시드 데이터 → http://localhost:3000
```

로컬 개발(docker 없이):

```bash
cd backend
# 통합 테스트: 실제 MariaDB가 필요하다. 기본값은 127.0.0.1:3399/otgyeol_test(root, 비밀번호 없음)이고
# TEST_DATABASE_URL·TEST_DATABASE_USERNAME·TEST_DATABASE_PASSWORD로 바꿀 수 있다. 테스트 시작 때 스키마를 지우고 다시 만든다.
./mvnw test
./mvnw spring-boot:run           # MariaDB(기본 127.0.0.1:3306/otgyeol) 사용. 다른 포트면 DATABASE_URL로 지정
```

화면 개발(백엔드가 3000에서 실행 중일 때, `/api`는 Vite가 3000으로 넘긴다):

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # 타입 검사 + 빌드(docker 이미지에서는 Spring 정적 파일로 들어간다)
```

로컬 MariaDB에는 utf8mb4 데이터베이스와 계정을 먼저 만든다.

```sql
CREATE DATABASE otgyeol CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'otgyeol'@'localhost' IDENTIFIED BY 'otgyeol';
GRANT ALL ON otgyeol.* TO 'otgyeol'@'localhost';
```

흐름 E2E(`docs/scenarios.yaml`의 S1~S8, 흐름마다 `e2e/scenarios/<id>.spec.ts`)는 docker 앱을 띄운 뒤 PC·휴대폰 화면 두 가지로 실행한다.
S2(택 AI 분석)는 실제 AI 응답이 필요해서 `AI_GATEWAY_API_KEY`가 설정된 상태로 앱을 띄워야 한다. CI는 `.github/workflows/scenarios.yml`이 같은 순서로 실행한다.

```bash
docker compose down -v && docker compose up -d --build
cd e2e
npm ci
npx playwright install chromium
npx playwright test              # BASE_URL로 다른 주소 지정 가능(기본 http://localhost:3000)
```

`e2e/fixtures/tag-care.jpg`, `tag-brand.jpg`는 화면에서 그려 만든 예시 택 사진이다. 실제 택 사진으로 바꿔도 된다.

백엔드 통합 테스트는 로컬 JDK·MariaDB 없이 docker로도 돌릴 수 있다.

```bash
docker network create otg-test
docker run -d --name otg-test-db --network otg-test -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=otgyeol_test mariadb:11.4
docker run --rm --network otg-test -v "$PWD/backend:/src" -w /src maven:3.9-eclipse-temurin-21 \
  bash -c "TEST_DATABASE_URL=jdbc:mariadb://otg-test-db:3306/otgyeol_test TEST_DATABASE_USERNAME=root TEST_DATABASE_PASSWORD=root mvn -B test"
```

## 환경변수

| 이름 | 용도 | 설정 위치 |
| ---- | ---- | --------- |
| `DATABASE_URL` | MariaDB JDBC 주소(`jdbc:mariadb://호스트:포트/otgyeol`) | `docker-compose.yml`, 배포 환경변수 |
| `DATABASE_USERNAME`, `DATABASE_PASSWORD` | DB 계정 | `docker-compose.yml`(로컬 전용 값), 배포 환경변수 |
| `AI_GATEWAY_API_KEY` | 택 분석·제품 검색·추천 AI 호출 | 로컬 환경변수, 배포 환경변수, GitHub Secrets |
| `AI_MODEL` | AI Gateway 모델 식별자(기본 `google/gemini-2.5-flash`) | 선택, 배포 환경변수 |
| `RELEASE_ID` | `/__health`가 응답하는 배포 commit | 빌드 인자·환경변수로 주입 |
| `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` | docker 시드 계정(로컬 전용, 배포에서는 비움) | `docker-compose.yml` |
