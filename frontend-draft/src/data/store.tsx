import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { DEFAULT_SPACES, SEED, isoDay, type Care, type Garment, type Loc, type Space } from './garments';
import { load, save } from '../lib/storage';

// 서버 API(/api/garments, /api/spaces, /api/care)가 붙기 전까지 브라우저에 저장하는 임시 저장소.
// 같은 함수 시그니처로 API 호출만 바꿔 끼우면 화면 코드는 그대로 쓸 수 있다.
const KEY = 'ot.garments.v4';
const SPACE_KEY = 'ot.spaces.v1';
const LOG_KEY = 'ot.carelog.v1';

type Action =
  | { type: 'add'; garment: Garment }
  | { type: 'update'; id: string; patch: Partial<Garment> }
  | { type: 'remove'; id: string }
  | { type: 'move'; ids: string[]; loc: Loc }
  | { type: 'place'; items: { id: string; loc: Loc }[] };

function reducer(state: Garment[], action: Action): Garment[] {
  switch (action.type) {
    case 'add':
      return [action.garment, ...state];
    case 'update':
      return state.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g));
    case 'remove':
      return state.filter((g) => g.id !== action.id);
    case 'move':
      return state.map((g) => (action.ids.includes(g.id) ? { ...g, loc: action.loc } : g));
    case 'place': {
      const map = new Map(action.items.map((i) => [i.id, i.loc]));
      return state.map((g) => (map.has(g.id) ? { ...g, loc: map.get(g.id)! } : g));
    }
  }
}

export interface CareLogEntry {
  id: string;
  garmentId: string;
  name: string;
  kind: Care['kind'];
  vendor?: string;
  doneAt: string;
}

interface StoreValue {
  garments: Garment[];
  spaces: Space[];
  careLog: CareLogEntry[];
  get: (id: string) => Garment | undefined;
  add: (g: Omit<Garment, 'id' | 'createdAt'>) => Garment;
  update: (id: string, patch: Partial<Garment>) => void;
  remove: (id: string) => void;
  move: (ids: string[], loc: Loc) => void;
  /** 배치 추천을 한꺼번에 확정 */
  place: (items: { id: string; loc: Loc }[]) => void;
  /** 오류가 있으면 이유를, 없으면 null */
  addSpace: (space: Space) => string | null;
  removeSpace: (name: string) => string | null;
  /** 회수 완료: 진행 중 기록을 닫고 이력에 남긴다 */
  completeCare: (garmentId: string) => void;
  setDue: (garmentId: string, due: string) => string | null;
}

const Ctx = createContext<StoreValue | null>(null);

export function GarmentsProvider({ children }: { children: ReactNode }) {
  const [garments, dispatch] = useReducer(reducer, null, () => {
    const stored = load<Garment[] | null>(KEY, null);
    if (!(Array.isArray(stored) && stored.every((g) => g && g.id))) return SEED;
    // 새로 추가된 샘플 옷은 기존 저장분을 지우지 않고 덧붙인다
    const have = new Set(stored.map((g) => g.id));
    return [...stored, ...SEED.filter((g) => g.id.startsWith('sample-') && !have.has(g.id))];
  });
  const [spaces, setSpaces] = useState<Space[]>(() => load<Space[]>(SPACE_KEY, DEFAULT_SPACES));
  const [careLog, setCareLog] = useState<CareLogEntry[]>(() => load<CareLogEntry[]>(LOG_KEY, []));

  useEffect(() => save(KEY, garments), [garments]);
  useEffect(() => save(SPACE_KEY, spaces), [spaces]);
  useEffect(() => save(LOG_KEY, careLog), [careLog]);

  const addSpace = useCallback(
    (space: Space) => {
      const name = space.name.trim();
      if (!name) return '공간 이름을 입력해 주세요';
      if (!Number.isFinite(space.capacity) || space.capacity < 1) return '수용 개수는 1 이상이어야 해요';
      if (spaces.some((s) => s.name === name)) return '같은 이름의 공간이 이미 있어요';
      setSpaces((prev) => [...prev, { ...space, name }]);
      return null;
    },
    [spaces],
  );

  const value = useMemo<StoreValue>(
    () => ({
      garments,
      spaces,
      careLog,
      get: (id) => garments.find((g) => g.id === id),
      add: (input) => {
        const garment: Garment = { ...input, id: `g${Date.now()}`, createdAt: Date.now() };
        dispatch({ type: 'add', garment });
        return garment;
      },
      update: (id, patch) => dispatch({ type: 'update', id, patch }),
      remove: (id) => dispatch({ type: 'remove', id }),
      move: (ids, loc) => dispatch({ type: 'move', ids, loc }),
      place: (items) => dispatch({ type: 'place', items }),
      addSpace,
      removeSpace: (name) => {
        if (garments.some((g) => g.loc?.space === name)) return '옷이 들어 있는 공간은 지울 수 없어요';
        setSpaces((prev) => prev.filter((s) => s.name !== name));
        return null;
      },
      completeCare: (garmentId) => {
        const g = garments.find((x) => x.id === garmentId);
        if (!g?.care) return;
        setCareLog((prev) => [
          { id: `c${Date.now()}`, garmentId, name: g.name, kind: g.care!.kind, vendor: g.care!.vendor, doneAt: isoDay(0) },
          ...prev,
        ]);
        dispatch({ type: 'update', id: garmentId, patch: { care: undefined } });
      },
      setDue: (garmentId, due) => {
        const g = garments.find((x) => x.id === garmentId);
        if (!g?.care) return '진행 중인 기록이 없어요';
        if (!due) return '날짜를 골라 주세요';
        if (g.care.since && due < g.care.since) return '회수 예정일은 맡긴 날보다 앞설 수 없어요';
        dispatch({ type: 'update', id: garmentId, patch: { care: { ...g.care, due } } });
        return null;
      },
    }),
    [garments, spaces, careLog, addSpace],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGarments() {
  const v = useContext(Ctx);
  if (!v) throw new Error('GarmentsProvider 안에서만 사용할 수 있어요');
  return v;
}
