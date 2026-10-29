// 사진을 가져오는 세 가지 길: 파일 / 주소 / 제품 코드. 택 글자 읽기·상품 검색은 서버(AI Gateway)가 하고, AI 다시 그리기는 아직 서버에 없다.
import { api } from './api';

/** 서버가 대신 내려받는다(개발 중에는 Vite 가 /api 를 Spring 으로 넘긴다) */
const PROXY = '/api/image-proxy';

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

export interface ProductHit { title: string; imageUrl: string; source: string; candidateId: number }
export interface ProductSearch { searchId: number; hits: ProductHit[]; message: string | null }

interface SearchResult {
  id: number;
  message: string | null;
  candidates: { id: number; name: string; imageUrl: string | null; sourceUrl: string; matchReason: string | null }[];
}

/** 브랜드 + 제품 코드로 인터넷에서 상품 사진을 찾는다 (계획서 R02). 결과가 없어도 검색 기록은 남는다. */
export async function lookupProduct(brand: string, code: string, extractionId?: number): Promise<ProductSearch> {
  const r = await api.post<SearchResult>('/api/products/search', { brand: brand || null, productCode: code, extractionId: extractionId ?? null });
  const host = (u: string) => { try { return new URL(u).hostname; } catch { return u; } };
  return {
    searchId: r.id,
    message: r.message,
    hits: r.candidates.filter((c) => c.imageUrl).map((c) => ({ title: c.name, imageUrl: c.imageUrl!, source: host(c.sourceUrl), candidateId: c.id })),
  };
}

export interface LabelRead {
  extractionId: number;
  /** 읽은 값: BRAND·PRODUCT_CODE·SIZE_LABEL·MATERIAL 등 */
  values: Partial<Record<string, string>>;
  failed: string | null;
}

/** 택 사진의 글자를 AI 로 읽는다 (계획서 R01). 못 읽은 칸은 비워 두고 직접 입력으로 계속한다. */
export async function readLabels(files: File[]): Promise<LabelRead> {
  const form = new FormData();
  files.slice(0, 4).forEach((f) => form.append('files', f));
  const r = await api.post<{ extraction: { id: number; status: string; errorMessage: string | null; values: { field: string; readValue: string | null }[] } }>('/api/labels/analyze', form);
  const values: LabelRead['values'] = {};
  r.extraction.values.forEach((v) => { if (v.readValue) values[v.field] = v.readValue; });
  return { extractionId: r.extraction.id, values, failed: r.extraction.status === 'FAILED' ? r.extraction.errorMessage ?? '택 글자를 읽지 못했어요' : null };
}

/** 누끼 딴 사진을 AI가 깨끗한 상품 사진으로 다시 그려 받는다 (서버가 AI Gateway 로 처리) */
export async function reconstructWithAI(png: Blob): Promise<Blob> {
  const r = await fetch('/api/garments/reconstruct', { method: 'POST', body: png, headers: { 'content-type': 'image/png' } }).catch(() => null);
  if (!r || !r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) throw new NotConnected();
  return r.blob();
}
