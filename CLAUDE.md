# CLAUDE.md: '내 옷장' 프로젝트 기억

이 파일은 Claude Code가 매 세션 시작 시 읽는 프로젝트 기억이다. 기획·디자인 단계(Claude 앱 대화)에서 확정된 내용을 옮겨 왔다.
결정이 바뀌면 이 파일을 먼저 고친다.

## 1. 프로젝트 한 줄 요약

사진으로 내 옷과 **보관 위치**를 등록하고, 검색·위치 변경·코디 저장을 하는 반응형 웹서비스.
무박 2일 해커톤용. 모바일 우선(390px 기준)이고 데스크톱에서도 쓸 수 있어야 한다.

- 임시 서비스명: **내 옷장** (기획 문서에 '옷길', '옷결'이라는 이름도 남아 있다. 최종 이름은 팀 결정 전이다.)
- 핵심 문제: 계절이 바뀔 때 가진 옷과 실제 보관 위치를 기억하고 찾기 어렵다.
- 핵심 흐름: 옷 사진 등록 → 기본 정보와 보관 위치 입력 → 목록에서 검색 → 위치 확인·변경 → 보유 의류로 코디 구성·저장.

## 2. 문서 지도 (작업 전에 필요한 것을 읽을 것)

| 경로 | 내용 | 우선순위 |
|---|---|---|
| `docs/design-system.md` | 색상 토큰(계절 4종), 글꼴, 간격, 컴포넌트 규칙, 문구 규칙 | **화면 구현 시 필수** |
| `docs/screens.md` | 화면별 구성, 문구, 상태, 이동 경로 | **화면 구현 시 필수** |
| `design/html/*.html` | 목업을 만든 정적 HTML. 실제 CSS 값의 원본이다 | 픽셀 값이 필요할 때 |
| `design/mockups/` | 목업 PNG (`iphone/`은 폰 프레임 합성본, `screens/`는 화면 단독) | 시각 확인용 |
| `docs/ui-draft.md` | 기획·UI/UX 초안 원문 (메뉴, 예외 상태, 우선순위) | 배경 이해 |
| `docs/feature-spec.yaml` | 팀 기능 명세 R00~R10 (택 OCR, 3D 코디, 세탁 관리 등 포함) | 기능 범위 참고 |
| `docs/reference-design-md.txt` | 참고한 외부 디자인 시스템 문서. 사진 중심·절제·토큰 개념만 차용 | 참고만 |

**충돌 시 우선순위:** 이 파일 > `docs/design-system.md` / `docs/screens.md` > `design/html` > `docs/ui-draft.md` > `docs/feature-spec.yaml`.
`feature-spec.yaml`은 UI 초안보다 범위가 넓다(3D 체형 모형, 세탁·수선 관리 등). 해커톤 1차 구현 범위는 아래 5절을 따른다.

## 3. 기술 스택 (기본안, 팀 확정 전)

- Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
  - Tailwind v4는 설정 파일 대신 `app/globals.css`의 `@theme inline`에서 CSS 변수를 클래스로 연결한다(`bg-primary`, `text-deep`, `rounded-card` …).
  - 전역 요소 스타일은 반드시 `@layer base` 안에 둔다. 레이어 밖에 두면 Tailwind 유틸리티(예: `text-on`)를 덮어쓴다.
  - 공통 UI: `components/ui/`(Button·Chip·Sheet·Toast), 아이콘 `components/icons.tsx`(목업 SVG 경로). 바텀시트와 토스트는 아이폰 화면 안에 그려진다.
  - 글꼴은 npm `pretendard`(가변 글꼴, dynamic subset)를 `app/layout.tsx`에서 불러온다.
  - 아이콘: 탭 바처럼 목업에 있는 아이콘은 `design/html`의 SVG를 그대로 옮기고, 목업에 없는 아이콘만 lucide-react를 쓴다.
- UI 컴포넌트: shadcn/ui를 필요한 것만 쓰고, 스타일은 `design-system.md` 토큰으로 덮어쓴다.
- 서버 상태: TanStack Query (나중에 백엔드를 붙일 때)
- 데이터: **처음에는 목업 데이터 + 저장소 인터페이스(repository)**로 시작한다. 이후 Supabase(Auth/Postgres/Storage)로 교체할 수 있게 데이터 접근을 한곳에 모은다.
- 배포: Vercel
- 3D(`@react-three/fiber`)는 1차 범위 밖이다.

팀이 다른 스택을 정하면 이 절을 고친다.

## 4. 디자인 핵심 규칙 (요약, 자세한 값은 docs/design-system.md)

- 아이보리 배경 `#F7F6F3`, 흰 카드 `#FFFFFF`, 얇은 테두리 `#E6E4E0`. 그림자는 거의 쓰지 않는다.
- 카드 모서리 16~18px, 버튼·칩·검색창은 알약형(999px).
- **계절 테마**: 포인트 색 하나와 같은 계열 보조색만 쓴다. CSS 변수 `--primary --on --soft --deep`로 전환한다.
  - 봄 `#F7B1B0` / 여름 `#2EC4B6` / 가을 `#A47148` / 겨울 `#134074`
  - 자동 테마: 한국 기준 3~5월 봄, 6~8월 여름, 9~11월 가을, 12~2월 겨울 (Asia/Seoul).
  - 테마는 화면 색만 바꾼다. 옷의 '계절' 속성과는 별개다. 바꿔도 검색어, 필터, 작성 중인 입력은 유지한다.
- 글꼴은 **화면 전체를 고딕 하나로 통일**한다: Pretendard → Noto Sans KR → system-ui. 명조체는 쓰지 않는다.
  굵기는 400 / 600 / 700만 쓴다(500은 보조 라벨에만 아주 드물게).
- 아이콘은 얇은 선형(stroke 1.5~1.7)으로 통일한다. lucide-react가 가장 가깝다.
- 사진은 정사각형 영역에 `object-fit: contain`과 여백을 두어 옷 전체가 보이게 한다.

## 5. 문구·줄바꿈 규칙 (사용자가 특히 강조함)

- 모든 화면 문구는 자연스러운 한국어 존댓말(~해요체)로 쓴다.
- 두 문장 이상 안내 문구는 **문장 단위로 줄을 직접 나눈다**. 예:
  `일교차가 커요.` (줄바꿈) `얇은 아우터를 챙겨 보세요.`
- 전역 `word-break: keep-all;`. 단어 중간에서 줄이 끊기면 안 된다.
- 줄바꿈 후 각 줄이 한 줄에 들어가야 한다. 넘치면 문장을 짧게 다듬는다. 3줄로 넘어가면 안 된다.
- 문구 목록은 `docs/screens.md`에 있다. 임의로 바꾸지 말고, 바꿔야 하면 이유를 남긴다.
- 목업이 없어서 새로 정한 문구 (팀 확인 필요):
  - 장소 선택 시트: 제목 `보관 위치 선택`, 확인 버튼 `위치 변경`
  - 필터 시트: 제목 `필터`, 묶음 `종류·계절·색상·보관 위치`, 버튼 `필터 초기화` · `n벌 보기`. 필터를 고르면 `필터 n`으로 개수를 보여 준다.
  - 정렬 메뉴: `최근 등록순` · `이름순`
  - 검색어 없이 필터만으로 결과가 없을 때: `조건에 맞는 옷이 없어요.` + `필터 초기화`

## 6. 해커톤 구현 범위

| 순위 | 내용 |
|---|---|
| 1순위 | 홈(인사말·검색·날씨 위젯, 날씨 상태는 목업 데이터), 내 옷장(카드 목록·검색·필터·정렬·선택 모드), 옷 등록·수정, 의류 상세(위치 변경), 계절 테마 전환 |
| 2순위 | 보관함(장소 목록·추가·이름 수정), 위치 일괄 변경, 코디 만들기·저장·목록, 마이, 화면 테마 설정, 빈 상태·오류 문구 |
| 3순위 | 실제 날씨 API 연동, 장소 하위 구조(옷장 A › 서랍 2), 코디 상세 편집, 데스크톱 레이아웃 다듬기 |
| 이후 확장 | 사진에서 종류·색상 후보 추출, 상품 택 OCR·상품 검색, 세탁 라벨 인식, 보유 의류 코디 추천, 3D 체형 모형 |
| 범위 제외 | 가상 착용, 쇼핑몰 결제, 캘린더 |

AI 기능 원칙: AI 결과는 항상 **미확정 상태로 보여 주고 사용자가 확인·수정**한 뒤 저장한다.
**보관 위치는 AI가 채우지 않는다.** 판독하지 못한 값은 '확인 필요'로 표시한다.

## 7. 정보 구조

- 하단 탭(모바일): **홈 · 내 옷장 · (+ 옷 등록, 가운데 원형 버튼) · 보관함 · 마이**
  - 처음 초안의 '코디'·'설정' 탭은 정리되었다. 코디는 홈 바로가기와 마이 > 저장한 코디에서 들어간다. 설정은 마이에 합쳤다.
  - 내 옷장·상세 목업(`closet-detail_*.png`, `closet_*.html`)의 하단 탭은 예전 구성(코디·설정)이다. 구현은 위 5칸을 따른다.
- **아이폰 미리보기 (2026-10-29 결정)**: 1차 구현에서는 너비 480px 이상인 화면에서 회색 배경 가운데에 390×844 아이폰 프레임(상태바 `9:41`, 다이내믹 아일랜드, 홈 인디케이터)을 띄우고 앱을 그 안에서 보여 준다. 창이 작으면 프레임 전체를 비율대로 줄인다. 480px 미만(실제 폰)에서는 프레임 없이 전체 화면이다. 관련 코드는 `components/layout/PhoneFrame.tsx`, `lib/phone.ts`, `globals.css`.
- 데스크톱: 같은 메뉴를 밝은 상단 바로 보여 준다(아직 목업 없음). 데스크톱 전용 레이아웃은 3순위로 미루고, 그전까지는 위 아이폰 프레임으로 보여 준다.
- 라우트 제안: `/` 홈, `/closet` 내 옷장, `/closet/[id]` 의류 상세, `/closet/new`·`/closet/[id]/edit` 등록·수정, `/storage` 보관함, `/storage/[id]` 장소 상세, `/outfits` 코디(만들기/저장한 코디), `/my` 마이, `/my/theme` 화면 테마.

## 8. 데이터 모델 초안

```ts
type Season = 'spring' | 'summer' | 'autumn' | 'winter';
type Category = 'top' | 'bottom' | 'outer' | 'shoes' | 'etc'; // 상의·하의·아우터·신발·기타

interface Place { id: string; name: string; parentId?: string | null; memo?: string; } // 1단계 하위까지
interface Garment {
  id: string; name: string; category: Category; color: string; // 색 이름(예: '브라운')
  seasons: Season[]; placeId: string | null;                   // null = '위치 미지정'
  photoUrl?: string; brand?: string; size?: string; material?: string; memo?: string;
  careInfo?: { text: string; confirmed: boolean }[];           // 세탁 라벨(확장)
  createdAt: string; updatedAt: string;
}
interface Outfit { id: string; name: string; memo?: string;
  slots: { outer?: string; top?: string; bottom?: string; shoes?: string; etc?: string }; // garment id
  createdAt: string; }
type ThemeSetting = 'auto' | Season;
```

R09 원칙: 화면들은 같은 garment id를 참조하므로, 한 화면에서 바꾼 값이 모든 화면에 같게 보여야 한다.

구현 (2단계, 2026-10-29):
- 타입은 `lib/types.ts`. 저장소 인터페이스는 `lib/repo/types.ts`(모두 Promise). 지금 구현은 `lib/repo/local.ts`(목업으로 시작, `closet.db` 키로 localStorage 저장). 백엔드를 붙일 때는 `lib/repo/index.ts`의 `repos`만 바꾼다.
- 화면은 repo를 직접 부르지 않고 `components/DataProvider.tsx`의 `useData()`를 쓴다. 쓰기는 repo를 거친 뒤 목록을 다시 읽어 모든 화면에 반영한다.
- 옷을 지우면 코디 슬롯에서도 빠진다. 장소를 지우면 하위 칸도 지워지고 그 안의 옷은 '미지정'이 된다.
- 목업 데이터는 `lib/mock/seed.ts`. 옷 그림은 `design/html/closet_*.html`에서 추출한 SVG(`lib/mock/art.ts`)를 `photoUrl`(data URL)로 넣었다. 실제 사진도 같은 `photoUrl`로 들어온다.
  - 장소 구조: 옷장 A(왼쪽 행거·오른쪽 행거·서랍 1~3), 옷장 B(행거), 수납 상자 1, 수납 상자 2, 신발장(1단·2단). 보관함 목업의 '행거 2 · 서랍 3'에 맞췄다.
  - 목업 카드의 '옷장 A · 행거'(카키 셔츠)는 옷장 A의 행거가 둘이라 '옷장 A · 오른쪽 행거'로 정리했다.
- 위치 표기는 카드 `옷장 A · 왼쪽 행거`, 상세·토스트 `옷장 A › 왼쪽 행거` (`lib/places.ts`의 `placePath`). 토스트의 '로/으로'는 `withRo`가 받침을 보고 고른다.
- 내 옷장의 검색어·칩·필터·정렬은 sessionStorage(`closet.query`)에 두어 상세나 다른 탭에 다녀와도 남는다. 홈 검색은 `/closet?q=검색어`로 넘긴다. 등록 직후 강조할 카드는 `/closet?new=id`.

## 9. 아직 팀이 정하지 않은 것

1. 데이터 저장 방식과 로그인 범위 (기기 저장 vs 계정·서버 저장). 기본은 목업 데이터 + 저장소 인터페이스로 둔다.
   - 임시 결정(2026-10-29): 목업 데이터를 시작값으로 쓰고, 바뀐 내용은 **localStorage**에 저장해 새로고침해도 남게 한다. 테마 설정 키는 `closet.theme`. 서버 저장은 repo 구현만 바꿔서 붙인다.
2. 보관 위치 구조: 1단계 vs 2단계(`옷장 A › 서랍 2`). 목업은 2단계 표기를 쓴다.
3. 코디 화면 방식: 고정 슬롯형(목업, 권장) vs 자유 배치형.
4. 최종 서비스명.
5. 날씨 API 출처, 위치 권한 처리.

## 10. 작업 방식

- 화면은 `design/html`의 해당 파일과 `design/mockups` 이미지를 열어 비교하며 구현한다. 완료 후 390×844에서 스크린샷을 찍어 목업과 대조한다.
  - 대조 방법: `npm run dev` 후 브라우저 창을 480×920 이상으로 두면 프레임이 1배(화면 390×844)로 나온다.
  - 계절 테마 확인용 임시 화면은 `/dev/theme`이다. `/my/theme`이 생기면 지운다.
- 화면 구조: 각 화면은 `components/layout/Screen.tsx`로 감싼다(상태바·탭 바 높이만큼 여백, 홈 날씨 배경은 `background`로 넘긴다). 탭이 있는 화면은 `app/(tabs)/` 아래에 둔다.
- 목업 속 옷 그림은 사진 대신 쓴 임시 SVG다. 실제 앱은 사용자 사진을 쓴다. 개발 중에는 플레이스홀더로 같은 SVG 스타일을 써도 된다.
- 이름 '하늘', 지역 '광주', 개수, 기온 같은 숫자는 모두 예시 데이터다.
- 커밋은 기능 단위로 작게 나눈다.
