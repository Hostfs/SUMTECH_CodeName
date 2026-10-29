import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { load, save } from '../lib/storage';

export interface Body {
  /** cm. 3D 모형 비율의 기준이라 필수 */
  height: number;
  shoulder?: number;
  chest?: number;
  waist?: number;
}

export interface Outfit {
  id: string;
  name: string;
  topId: string | null;
  bottomId: string | null;
  /** 예전에 저장한 코디에는 없을 수 있다 */
  outerId?: string | null;
  shoesId?: string | null;
  createdAt: number;
}

export const BODY_RANGE = {
  height: [100, 230],
  shoulder: [25, 70],
  chest: [50, 160],
  waist: [40, 150],
} as const;

export const BODY_LABEL = { height: '키', shoulder: '어깨너비', chest: '가슴둘레', waist: '허리둘레' } as const;

/** 범위 밖 치수는 거부한다 (R05). 비워 둔 항목은 통과. */
export function validateBody(b: Record<keyof typeof BODY_RANGE, string>): { body?: Body; errors: Partial<Record<keyof typeof BODY_RANGE, string>> } {
  const errors: Partial<Record<keyof typeof BODY_RANGE, string>> = {};
  const out: Partial<Body> = {};
  (Object.keys(BODY_RANGE) as (keyof typeof BODY_RANGE)[]).forEach((k) => {
    const raw = b[k].trim();
    const [lo, hi] = BODY_RANGE[k];
    if (!raw) {
      if (k === 'height') errors[k] = '키를 입력해 주세요';
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < lo || n > hi) errors[k] = `${BODY_LABEL[k]}는 ${lo}~${hi}cm 사이로 입력해 주세요`;
    else out[k] = Math.round(n * 10) / 10;
  });
  return Object.keys(errors).length ? { errors } : { body: out as Body, errors };
}

interface Value {
  body: Body | null;
  setBody: (b: Body | null) => void;
  outfits: Outfit[];
  saveOutfit: (name: string, items: Pick<Outfit, 'topId' | 'outerId' | 'bottomId' | 'shoesId'>) => Outfit;
  removeOutfit: (id: string) => void;
}

const Ctx = createContext<Value | null>(null);

export function OutfitsProvider({ children }: { children: ReactNode }) {
  const [body, setBodyState] = useState<Body | null>(() => load<Body | null>('ot.body.v1', null));
  const [outfits, setOutfits] = useState<Outfit[]>(() => load<Outfit[]>('ot.outfits.v1', []));

  useEffect(() => save('ot.body.v1', body), [body]);
  useEffect(() => save('ot.outfits.v1', outfits), [outfits]);

  const value = useMemo<Value>(
    () => ({
      body,
      setBody: setBodyState,
      outfits,
      saveOutfit: (name, items) => {
        const o: Outfit = { id: `o${Date.now()}`, name: name.trim(), ...items, createdAt: Date.now() };
        setOutfits((prev) => [o, ...prev]);
        return o;
      },
      removeOutfit: (id) => setOutfits((prev) => prev.filter((o) => o.id !== id)),
    }),
    [body, outfits],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOutfits() {
  const v = useContext(Ctx);
  if (!v) throw new Error('OutfitsProvider 안에서만 사용할 수 있어요');
  return v;
}
