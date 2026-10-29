# 옷결 프론트엔드

Vite + React + TypeScript. 모바일 전용 UI(아이폰 390×844 비율)다. 큰 화면에서는 폰 모양 틀 안에 앱이 들어간다.

- **로그인 · 회원가입**: 이메일·비밀번호, 계정마다 옷장이 따로다 (R00)
- **홈**: 실시간 날씨(Open-Meteo) 배경, 옷차림 한마디, 날씨에 맞는 내 옷 추천, 알림 종, 프로필 메뉴
- **내 옷장 · 옷 정보 · 옷 등록**: 검색·필터·여러 벌 선택 후 위치 변경, 세탁·수선 맡기기, 직접 입력 등록
- **옷 등록**: 옷 사진 / 택·제품 코드 / 사진 주소 / 사진 없이. 사진은 브라우저 안에서 자동으로 누끼(배경·신발·맨살 제거) → 핏 기준점(목·어깨·소매끝·밑단) 추정 → 사용자가 점을 끌어 보정 → 마네킹에 입혀 보기
- **코디 스튜디오**: 2D 앞모습 마네킹에 아우터·상의·하의·신발 입히기. 옷 사진을 마네킹 어깨선 각도에 맞춰 변형(워프)하고, 품·기장은 슬라이더로 조절. 신체 치수, 코디 저장, 규칙 기반 추천
- **보관함**: 옷장 지도(용량·배치 추천·공간 추가)와 관리함(기한 지남·오늘 회수·진행 중·완료 이력)

옷·공간·세탁 기록과 사진은 Spring 서버(`/api/**`, 세션 쿠키 로그인)에 저장한다. 이 기기에만 두는 것은 코디·신체 치수(`data/outfits.tsx`)와 사진 위 핏 기준점·품/기장 배율(옷 ID별)뿐이다. 다른 기기에서 등록한 사진은 기준점을 사진에서 다시 찾는다.

```bash
npm install
npm run dev      # http://localhost:5173 (/api 는 http://localhost:3000 의 Spring 으로 넘긴다. 다른 주소면 API_URL=…)
npm run build    # tsc + vite build → dist/
```

## 확인용 주소 옵션

| 주소 | 효과 |
| --- | --- |
| `/?season=winter` | 계절 테마 고정 (`spring` `summer` `autumn` `winter`) |
| `/?wx=snow-night` | 날씨 샘플 고정 (`clear-day` `clear-night` `cloudy-day` `cloudy-night` `rain-day` `rain-night` `snow-day` `snow-night`) |

홈 우측 상단 프로필 메뉴에서도 앱 테마(자동·봄·여름·가을·겨울)와 날씨 미리보기를 바꿀 수 있다.

## 구조

```
src/
  styles/        theme.css(계절·밤 색 토큰) base · layout · home · closet · detail
  lib/
    weather.ts           Open-Meteo 호출, 샘플, 옷차림 한마디(adviceFor)
    WeatherProvider.tsx  실시간/샘플 날씨 상태
    recommend.ts         날씨 → 내 옷장에서 꺼낼 옷 고르기 (규칙 기반)
    theme.tsx seasons.ts 계절 테마 (자동은 오늘 날짜 기준)
    outfitRec.ts         상황·계절별 상의·하의·신발 조합 추천 (규칙 기반)
    placement.ts         미배치 옷 보관 자리 추천 (용량 반영)
    notifications.ts     세탁·수선 기한, 미배치, 날씨에서 계산하는 알림
    cutout.ts            사진 → 누끼(배경 제거 / 의류 분할 모델) → 핏 기준점 추정
    fit.ts               2D 마네킹 기준점, 사진 → 마네킹 워프·그리기
    api.ts auth.tsx      서버 호출·오류 문구, 로그인 상태(401이면 로그인 화면으로)
    importImage.ts       사진 주소 불러오기(서버 프록시), 택 글자 읽기·제품 검색(AI), AI 다시 그리기 어댑터
  data/
    garments.ts  옷 타입·상태 계산(세탁 중/수선 중/미배치)
    convert.ts   서버 코드 ↔ 화면 값(세부 종류↔모양, 공간 유형↔종류, 소재 표↔'울 70%, 폴리 30%')
    store.tsx    옷·공간·세탁 기록. 서버에 쓰고 목록을 다시 읽는다
  components/    Sky(날씨 하늘) Studio2D(2D 마네킹) FitEditor(핏 점 편집) GarmentImage GarmentArt Sheet NoticeBell …
  pages/         Auth Home Closet GarmentDetail Register Storage Outfit
```

## 서버와 맞춘 방식

- 화면의 공간·칸은 서버 공간 트리의 '가장 바깥 공간'과 '그 안쪽 끝 공간'이다. 옷은 칸(끝 공간)에만 넣는다.
- 공간 종류: 걸기=HANG, 서랍=FOLD, 선반=SHELF, 상자=LONG_TERM(박스 BOX도 상자로 보임), 집 밖=OFFSITE.
- 옷 모양은 서버 세부 종류에서 정한다(예: 청바지→바지 그림). 보온 정도는 모양에서 계산한다.
- 회수 완료를 누르면 서버 기준으로 '위치 미확인'이 되어 미배치로 보이고, 보관함의 배치 추천·위치 변경으로 다시 넣으면 보관 중이 된다(R08).
- 등록할 때 원본 사진과 누끼 정리본을 함께 올린다(정리본이 대표, R03). 택 사진이 있으면 '사진 찾기' 전에 글자를 읽어 브랜드·품번을 채운다(R01·R02).
- 위치 기본값은 `lib/weather.ts` 의 `PLACE`. 날씨는 지금 Open-Meteo 를 직접 부른다(서버 `/api/weather`는 쓰지 않음).
- 하단 메뉴 이름은 `components/Layout.tsx` 의 `TABS` 한 곳에서만 정한다.

## 옷 사진 처리 (누끼·핏)

- **옷만 있는 사진**: 가장자리 색으로 배경을 지운다. 즉시 끝난다.
- **사람이 입은 사진**: `Xenova/segformer_b2_clothes`(약 29MB, 처음 한 번 내려받아 브라우저에 캐시)로 상의·바지·신발·피부를 구분하고, 분할 결과는 옷 색/배경 색을 뽑는 씨앗으로만 쓴 뒤 경계는 색으로 다시 판정한다. 신발·다리·얼굴은 무조건 제외한다.
- 생성형 AI로 옷을 다시 그리지 않고 **사진의 픽셀을 그대로** 변형해서 쓴다 (없는 디테일이 생기지 않는다).
- 모델 가중치의 학습 데이터(LIP·ATR) 약관은 상업 서비스로 내기 전에 확인해야 한다.

## 서버 API

| 기능 | API |
| --- | --- |
| 로그인·가입·로그아웃 | `/api/auth/*` |
| 옷 목록·상세·등록·수정·삭제 | `/api/garments` |
| 공간·옷 넣기 | `/api/spaces`, `POST /api/spaces/{id}/garments` |
| 세탁·수선 맡기기·예정일·회수 | `POST /api/garments/{id}/care`, `/api/care` |
| 사진 올리기·정리본 기록 | `POST /api/images`, `POST /api/garments/{id}/images/{imageId}/processing` |
| 다른 사이트 이미지 가져오기(CORS 우회) | `GET /api/image-proxy?url=` |
| 택 글자 읽기 · 제품 사진 검색 | `POST /api/labels/analyze`, `POST /api/products/search` |
| AI로 깔끔하게 다시 그리기 | `POST /api/garments/reconstruct` — 서버에 없음(누르면 '연결 필요' 안내) |
