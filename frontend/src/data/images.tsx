import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Photo } from './garments';

// 누끼 딴 옷 사진은 용량이 커서 localStorage 대신 IndexedDB 에 둔다. 서버가 붙으면 /api/images 로 바꾼다.
const DB = 'ot-images';
const STORE = 'img';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

interface Value {
  /** 'idb:<id>' 로 저장한 사진의 화면용 주소 */
  urls: Record<string, string>;
  save: (blob: Blob) => Promise<string>;
  remove: (src: string) => Promise<void>;
}
const Ctx = createContext<Value | null>(null);

export function ImagesProvider({ children }: { children: ReactNode }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const db = await open();
        const store = db.transaction(STORE).objectStore(STORE);
        const keys = await new Promise<IDBValidKey[]>((r) => { const q = store.getAllKeys(); q.onsuccess = () => r(q.result); });
        const vals = await new Promise<Blob[]>((r) => { const q = store.getAll(); q.onsuccess = () => r(q.result as Blob[]); });
        if (!alive) return;
        const next: Record<string, string> = {};
        keys.forEach((k, i) => { next[String(k)] = URL.createObjectURL(vals[i]); });
        setUrls(next);
      } catch {
        /* 사진 저장소를 못 열어도 앱은 일러스트로 계속 동작한다 */
      }
    })();
    return () => { alive = false; };
  }, []);

  const save = useCallback(async (blob: Blob) => {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await tx('readwrite', (s) => s.put(blob, id));
    setUrls((u) => ({ ...u, [id]: URL.createObjectURL(blob) }));
    return `idb:${id}`;
  }, []);

  const remove = useCallback(async (src: string) => {
    if (!src.startsWith('idb:')) return;
    const id = src.slice(4);
    await tx('readwrite', (s) => s.delete(id));
    setUrls((u) => { const n = { ...u }; delete n[id]; return n; });
  }, []);

  const value = useMemo(() => ({ urls, save, remove }), [urls, save, remove]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useImages() {
  const v = useContext(Ctx);
  if (!v) throw new Error('ImagesProvider 안에서만 사용할 수 있어요');
  return v;
}

/** 사진의 화면용 주소. 아직 읽는 중이면 null */
export function useImageUrl(photo?: Photo): string | null {
  const { urls } = useImages();
  if (!photo) return null;
  return photo.src.startsWith('idb:') ? urls[photo.src.slice(4)] ?? null : photo.src;
}
