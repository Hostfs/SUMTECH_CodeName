// 사진을 가져오는 세 가지 길: 파일 / 주소 / 제품 코드. 서버 쪽 기능(상품 검색·AI 변환)은 아직 없어서 어댑터만 둔다.

/** 개발 서버는 /__fetch-image, 운영(Spring)은 /api/image-proxy 가 같은 일을 한다 */
const PROXY = import.meta.env.DEV ? '/__fetch-image' : '/api/image-proxy';

export class NotConnected extends Error {}

/** 다른 사이트의 이미지는 브라우저가 직접 못 읽는 경우가 많아서(CORS) 막히면 서버를 거친다 */
export async function fetchImage(url: string): Promise<Blob> {
  const clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) throw new Error('http:// 또는 https:// 로 시작하는 이미지 주소를 붙여 넣어 주세요');
  try {
    const r = await fetch(clean, { mode: 'cors' });
    if (r.ok && (r.headers.get('content-type') ?? '').startsWith('image/')) return await r.blob();
  } catch {
    /* CORS 에 막히면 아래로 */
  }
  const r = await fetch(`${PROXY}?url=${encodeURIComponent(clean)}`);
  const type = r.headers.get('content-type') ?? '';
  if (!r.ok || !type.startsWith('image/')) {
    const msg = type.includes('json') ? ((await r.json().catch(() => ({}))) as { error?: string }).error : undefined;
    throw new Error(msg ?? '이 주소에서 이미지를 가져오지 못했어요. 이미지를 길게 눌러 ‘이미지 주소 복사’로 다시 붙여 넣어 보세요');
  }
  return r.blob();
}

export interface ProductHit { title: string; imageUrl: string; source: string }

/** 브랜드 + 제품 코드로 인터넷에서 상품 사진을 찾는다 (계획서 R02, 서버의 검색 도구가 하는 일) */
export async function lookupProduct(brand: string, code: string): Promise<ProductHit[]> {
  const r = await fetch(`/api/products/lookup?brand=${encodeURIComponent(brand)}&code=${encodeURIComponent(code)}`).catch(() => null);
  if (!r || !r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new NotConnected();
  return (await r.json()) as ProductHit[];
}

/** 누끼 딴 사진을 AI가 깨끗한 상품 사진으로 다시 그려 받는다 (서버가 AI Gateway 로 처리) */
export async function reconstructWithAI(png: Blob): Promise<Blob> {
  const r = await fetch('/api/garments/reconstruct', { method: 'POST', body: png, headers: { 'content-type': 'image/png' } }).catch(() => null);
  if (!r || !r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) throw new NotConnected();
  return r.blob();
}
