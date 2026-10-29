/**
 * 상세 화면 주소. 정적 사이트로 배포하기 위해 경로 대신 ?id= 를 쓴다
 * (Windows에서 동적 경로를 배포하면 Vercel 업로드가 실패한다. CLAUDE.md 7절).
 */
export const garmentHref = (id: string) => `/closet/view?id=${encodeURIComponent(id)}`;
export const garmentEditHref = (id: string) => `/closet/edit?id=${encodeURIComponent(id)}`;
export const placeHref = (id: string) => `/storage/view?id=${encodeURIComponent(id)}`;
export const outfitHref = (id: string) => `/outfits/view?id=${encodeURIComponent(id)}`;
