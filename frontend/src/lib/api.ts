// Spring 서버(/api/**) 호출. 같은 주소에서 세션 쿠키로 로그인하므로 따로 토큰을 붙이지 않는다.
// 실패하면 서버가 준 한국어 문구({ error })를 담아 ApiError 를 던진다.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** 로그인이 풀렸을 때(401) 부르는 함수. AuthProvider 가 정한다. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요');
  }
  if (res.status === 401 && !url.startsWith('/api/auth/')) onUnauthorized?.();
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, data?.error ?? '요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요');
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T>(url: string, body: unknown) => request<T>('PUT', url, body),
  patch: <T>(url: string, body: unknown) => request<T>('PATCH', url, body),
  del: <T>(url: string) => request<T>('DELETE', url),
};

export const errorText = (e: unknown, fallback = '처리하지 못했어요') => (e instanceof Error && e.message ? e.message : fallback);

// ---- 서버 응답 형태 (backend GarmentDtos·SpaceController·CareController 와 같다) ----

export interface MaterialView { part: string; partLabel: string; fiber: string; fiberLabel: string; percent: number }

export interface GarmentSummary {
  id: number;
  name: string;
  brand: string | null;
  colorName: string | null;
  colorHex: string | null;
  category: string;
  subType: string;
  seasons: string[];
  collections: string[];
  wearFrequency: string;
  status: string;
  spaceId: number | null;
  locationKind: string;
  imageUrl: string | null;
  createdAt: string;
  sizeLabel: string | null;
  memo: string | null;
  materials: MaterialView[];
}

export interface GarmentDetail {
  summary: GarmentSummary;
  productCode: string | null;
  sizeLabel: string | null;
  origin: string | null;
  usableWhenPending: boolean;
  aiFields: string[];
  materials: MaterialView[];
  careLines: string[];
  measurements: { part: string; kind: string; valueCm: number; source: string | null }[];
  coverImageId: number | null;
  images: { id: number; kind: string; url: string; processedFromId: number | null }[];
}

export interface CareView {
  id: number;
  careType: 'WASH' | 'REPAIR';
  place: 'HOME' | 'SHOP';
  shopName: string | null;
  description: string | null;
  droppedOn: string;
  dueOn: string | null;
  completedAt: string | null;
}

export interface CareBoard {
  today: string;
  inProgress: { care: CareView; garment: GarmentSummary }[];
  history: { care: CareView; garment: GarmentSummary }[];
}

export interface SpaceView { id: number; parentId: number | null; name: string; spaceType: string; capacity: number | null }
export interface MapView { spaces: SpaceView[]; unplaced: GarmentSummary[] }

export interface Me { id: number; email: string }
