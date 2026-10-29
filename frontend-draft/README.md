# 옷결 프론트엔드 초안

Vite + React + TypeScript. 모바일 전용 UI(아이폰 390×844 비율)다. 큰 화면에서는 폰 모양 틀 안에 앱이 들어간다.

- **홈**: 실시간 날씨(Open-Meteo) 배경, 옷차림 한마디, 날씨에 맞는 내 옷 추천, 알림 종, 프로필 메뉴
- **내 옷장 · 옷 정보 · 옷 등록**: 검색·필터·여러 벌 선택 후 위치 변경, 세탁·수선 맡기기, 직접 입력 등록
- **옷 등록**: 옷 사진 / 택·제품 코드 / 사진 주소 / 사진 없이. 사진은 브라우저 안에서 자동으로 누끼(배경·신발·맨살 제거) → 핏 기준점(목·어깨·소매끝·밑단) 추정 → 사용자가 점을 끌어 보정 → 마네킹에 입혀 보기
- **코디 스튜디오**: 2D 앞모습 마네킹에 아우터·상의·하의·신발 입히기. 옷 사진을 마네킹 어깨선 각도에 맞춰 변형(워프)하고, 품·기장은 슬라이더로 조절. 신체 치수, 코디 저장, 규칙 기반 추천
- **보관함**: 옷장 지도(용량·배치 추천·공간 추가)와 관리함(기한 지남·오늘 회수·진행 중·완료 이력)

데이터는 브라우저(localStorage)에 저장한다. 서버 API가 붙기 전의 초안이다.

```bash
npm install
npm run dev      # http://localhost:5173
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
    importImage.ts       사진 주소 불러오기, 제품 코드 검색·AI 다시 그리기 어댑터(서버 필요)
  data/
    garments.ts  옷 타입·시드 데이터·상태 계산(세탁 중/수선 중/미배치)
    store.tsx    옷 목록 저장소. API 연동 시 이 파일만 바꾸면 된다
  components/    Sky(날씨 하늘) Studio2D(2D 마네킹) FitEditor(핏 점 편집) GarmentImage GarmentArt Sheet NoticeBell …
  pages/         Home Closet GarmentDetail Register Storage Outfit
```

## 서버·AI 연결 때 바꿀 곳

- 위치 기본값은 `lib/weather.ts` 의 `PLACE` (광주창조경제혁신센터, 광주 서구 경열로17번길 12). 휴대폰에서는 `navigator.geolocation` 으로 교체.
- `data/store.tsx`(옷·공간·세탁 이력)와 `data/outfits.tsx`(신체 치수·코디)를 `/api/*` 호출로 교체 (계획서 API 요약 참고).
- 코디·배치 추천은 지금 규칙 기반이다. AI 연결 시 `lib/outfitRec.ts`·`lib/placement.ts` 의 입출력(옷 ID + 이유)만 맞추면 화면은 그대로다.
- 알림은 앱을 열 때 기록에서 계산한다. 앱이 닫힌 동안의 푸시는 범위 밖이다.
- `pages/Register.tsx` 의 '택 분석하기'는 아직 연결되지 않았다(R01). 연결 전에는 직접 입력으로 끝까지 등록된다.
- 하단 메뉴 이름은 `components/Layout.tsx` 의 `TABS` 한 곳에서만 정한다. 계획서의 메뉴 이름(`관리함`·`코디 스튜디오`·`옷장 지도`)으로 맞출 때 여기만 고치면 된다.
- 라우터는 `HashRouter` 다. Spring 이 index.html 폴백을 주면 `BrowserRouter` 로 바꿔도 된다.

## 옷 사진 처리 (누끼·핏)

- **옷만 있는 사진**: 가장자리 색으로 배경을 지운다. 즉시 끝난다.
- **사람이 입은 사진**: `Xenova/segformer_b2_clothes`(약 29MB, 처음 한 번 내려받아 브라우저에 캐시)로 상의·바지·신발·피부를 구분하고, 분할 결과는 옷 색/배경 색을 뽑는 씨앗으로만 쓴 뒤 경계는 색으로 다시 판정한다. 신발·다리·얼굴은 무조건 제외한다.
- 생성형 AI로 옷을 다시 그리지 않고 **사진의 픽셀을 그대로** 변형해서 쓴다 (없는 디테일이 생기지 않는다).
- 모델 가중치의 학습 데이터(LIP·ATR) 약관은 상업 서비스로 내기 전에 확인해야 한다.

## 서버가 붙어야 하는 기능

| 기능 | 어댑터 | 상태 |
| --- | --- | --- |
| 다른 사이트 이미지 가져오기(CORS 우회) | `GET /api/image-proxy?url=` (개발 서버는 `/__fetch-image`) | 개발 서버만 |
| 제품 코드로 상품 사진 검색 | `GET /api/products/lookup?brand=&code=` | 미연결 (R02) |
| AI로 깔끔하게 다시 그리기 | `POST /api/garments/reconstruct` (png → png) | 미연결 |
