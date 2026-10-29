import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isoDay, type Care, type Category, type Garment, type Loc, type Photo, type Space } from './garments';
import { CATEGORY_OF, WARMTH, careOf, hexOf, materialText, parseMaterials, seasonCodes, seasonsOf, shapeOf, spaceKindOf, spaceTypeOf, subTypeFor } from './convert';
import { api, errorText, type CareBoard, type GarmentDetail, type GarmentSummary, type MapView } from '../lib/api';
import { estimatePoints, loadCanvas, type PhotoKind } from '../lib/cutout';
import { DEFAULT_FIT } from '../lib/fit';
import { load, save } from '../lib/storage';
import { useToast } from '../lib/toast';

// 옷·공간·세탁 기록은 서버(/api/garments, /api/spaces, /api/care)에 둔다. 바꿀 때마다 서버에 쓰고 세 목록을 다시 읽는다.
// 사진 위 핏 기준점과 품·기장 배율은 코디 화면에서만 쓰는 값이라 이 기기(localStorage)에 옷 ID별로 둔다.
const META_KEY = 'ot.photometa.v1';
type PhotoMeta = Photo;

const KIND_OF: Record<Category, PhotoKind> = { 상의: 'top', 아우터: 'outer', 하의: 'bottom', 신발: 'shoes', 기타: 'top' };

export interface CareLogEntry {
  id: string;
  garmentId: string;
  name: string;
  kind: Care['kind'];
  vendor?: string;
  doneAt: string;
}

/** 등록할 때 함께 올리는 사진. original 이 있으면 원본으로 저장하고 photo 를 정리본(R03)으로 기록한다. */
export interface AddOptions {
  photo?: Blob;
  original?: Blob;
  /** 택 분석(R01)·제품 검색(R02) 기록 */
  extractionId?: number;
  searchId?: number;
  candidateId?: number;
}

interface StoreValue {
  garments: Garment[];
  spaces: Space[];
  careLog: CareLogEntry[];
  get: (id: string) => Garment | undefined;
  add: (g: Omit<Garment, 'id' | 'createdAt'>, opts?: AddOptions) => Promise<Garment>;
  update: (id: string, patch: Partial<Garment>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  move: (ids: string[], loc: Loc) => Promise<void>;
  /** 배치 추천을 한꺼번에 확정 */
  place: (items: { id: string; loc: Loc }[]) => Promise<void>;
  /** 오류가 있으면 이유를, 없으면 null */
  addSpace: (space: Space) => Promise<string | null>;
  removeSpace: (name: string) => Promise<string | null>;
  /** 회수 완료: 진행 중 기록을 닫는다. 옷은 '위치 미확인'(미배치)이 되어 다시 넣어야 보관 중이 된다 (R08). */
  completeCare: (garmentId: string) => Promise<void>;
  setDue: (garmentId: string, due: string) => Promise<string | null>;
}

const Ctx = createContext<StoreValue | null>(null);

interface Snapshot {
  garments: Garment[];
  spaces: Space[];
  careLog: CareLogEntry[];
  /** 서버 공간 ID ↔ 화면 위치(공간·칸) */
  leafOf: Map<string, number>;
  topOf: Map<string, { id: number; children: number[] }>;
}

const locKey = (loc: Loc) => `${loc.space}\u0000${loc.slot ?? ''}`;
const localDay = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** 서버의 공간 트리를 화면의 '공간 + 칸' 두 단계로 옮긴다. 가장 바깥 공간이 화면의 공간, 그 안쪽 끝 공간들이 칸이다. */
function toSpaces(map: MapView) {
  const byParent = new Map<number | null, typeof map.spaces>();
  map.spaces.forEach((s) => byParent.set(s.parentId, [...(byParent.get(s.parentId) ?? []), s]));
  const spaces: Space[] = [];
  const leafOf = new Map<string, number>();
  const locOf = new Map<number, Loc>();
  const topOf = new Map<string, { id: number; children: number[] }>();
  for (const top of byParent.get(null) ?? []) {
    const leaves: { id: number; path: string; capacity: number | null }[] = [];
    const all: number[] = [];
    const walk = (id: number, path: string[]) => {
      const kids = byParent.get(id) ?? [];
      kids.forEach((k) => {
        all.push(k.id);
        const next = [...path, k.name];
        if (byParent.get(k.id)?.length) walk(k.id, next);
        else leaves.push({ id: k.id, path: next.join(' › '), capacity: k.capacity });
      });
    };
    walk(top.id, []);
    const childCap = leaves.reduce((sum, l) => sum + (l.capacity ?? 0), 0);
    spaces.push({ name: top.name, kind: spaceKindOf(top.spaceType), capacity: top.capacity ?? (childCap || 99), slots: leaves.map((l) => l.path) });
    topOf.set(top.name, { id: top.id, children: all.reverse() });
    if (!leaves.length) {
      leafOf.set(locKey({ space: top.name }), top.id);
      locOf.set(top.id, { space: top.name });
    }
    leaves.forEach((l) => {
      leafOf.set(locKey({ space: top.name, slot: l.path }), l.id);
      locOf.set(l.id, { space: top.name, slot: l.path });
    });
  }
  return { spaces, leafOf, locOf, topOf };
}

export function GarmentsProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState('');
  const [meta, setMeta] = useState<Record<string, PhotoMeta>>(() => load<Record<string, PhotoMeta>>(META_KEY, {}));
  const hydrating = useRef(new Set<string>());

  useEffect(() => save(META_KEY, meta), [meta]);

  const reload = useCallback(async () => {
    const [list, map, board] = await Promise.all([
      api.get<GarmentSummary[]>('/api/garments'),
      api.get<MapView>('/api/spaces'),
      api.get<CareBoard>('/api/care'),
    ]);
    const { spaces, leafOf, locOf, topOf } = toSpaces(map);
    const careBy = new Map(board.inProgress.map((i) => [i.garment.id, careOf(i.care)]));
    const garments = list.map((s): Garment => {
      const shape = shapeOf(s.subType);
      return {
        id: String(s.id),
        name: s.name,
        category: CATEGORY_OF[s.category] ?? '기타',
        shape,
        color: s.colorName ?? '',
        hex: hexOf(s.colorName, s.colorHex),
        seasons: seasonsOf(s.seasons),
        // 회수 후 위치를 다시 확인하기 전(UNPLACED)에는 미배치로 보여 준다
        loc: s.locationKind === 'UNPLACED' || s.spaceId == null ? null : locOf.get(s.spaceId) ?? null,
        brand: s.brand ?? undefined,
        size: s.sizeLabel ?? undefined,
        material: s.materials.length ? materialText(s.materials) : undefined,
        memo: s.memo ?? undefined,
        warmth: WARMTH[shape],
        care: careBy.get(s.id),
        photo: s.imageUrl ? { src: s.imageUrl, w: 0, h: 0, kind: KIND_OF[CATEGORY_OF[s.category] ?? '기타'], points: {}, fit: DEFAULT_FIT, source: 'upload' } : undefined,
        createdAt: new Date(s.createdAt).getTime(),
      };
    });
    const careLog = board.history.map((i): CareLogEntry => ({
      id: String(i.care.id),
      garmentId: String(i.garment.id),
      name: i.garment.name,
      kind: i.care.careType === 'WASH' ? '세탁' : '수선',
      vendor: i.care.shopName ?? undefined,
      doneAt: localDay(i.care.completedAt!),
    }));
    setSnap({ garments, spaces, careLog, leafOf, topOf });
  }, []);

  useEffect(() => {
    reload().catch((e) => setFailed(errorText(e, '옷장을 불러오지 못했어요')));
  }, [reload]);

  // 다른 기기에서 등록해 이 기기에 핏 기준점이 없는 사진은 사진에서 다시 찾는다
  useEffect(() => {
    snap?.garments.forEach((g) => {
      if (!g.photo || meta[g.id]?.src === g.photo.src || hydrating.current.has(g.id)) return;
      hydrating.current.add(g.id);
      const { src, kind } = g.photo;
      loadCanvas(src, 4096)
        .then((c) => setMeta((m) => ({ ...m, [g.id]: { src, w: c.width, h: c.height, kind, points: estimatePoints(c, kind), fit: DEFAULT_FIT, source: 'upload' } })))
        .catch(() => { /* 사진을 못 읽으면 일러스트로 보여 준다 */ });
    });
  }, [snap, meta]);

  /** 서버에 쓰고 다시 읽는다. 실패하면 서버 문구를 알리고(또는 돌려주고) 화면을 서버 상태로 되돌린다. */
  const write = useCallback(
    async (fn: () => Promise<unknown>, quiet = false): Promise<string | null> => {
      try {
        await fn();
        return null;
      } catch (e) {
        const msg = errorText(e);
        if (!quiet) toast(msg);
        return msg;
      } finally {
        await reload().catch(() => {});
      }
    },
    [reload, toast],
  );

  const value = useMemo<StoreValue | null>(() => {
    if (!snap) return null;
    // 기준점이 준비된 사진만 사진으로, 아니면 일러스트로 보여 준다
    const garments = snap.garments.map((g) => {
      if (!g.photo) return g;
      const m = meta[g.id];
      return m?.src === g.photo.src ? { ...g, photo: m } : { ...g, photo: undefined };
    });
    const leaf = (loc: Loc) => {
      const id = snap.leafOf.get(locKey(loc));
      if (id == null) throw new Error('없는 보관 위치예요. 화면을 새로고침해 주세요');
      return id;
    };
    const putInto = (spaceId: number, ids: string[]) => api.post(`/api/spaces/${spaceId}/garments`, { garmentIds: ids.map(Number) });

    /** 서버 입력 전체를 만든다(PUT 은 빠진 칸을 지우므로 화면에 없는 값—품번·치수·세탁 지시 등—은 상세에서 그대로 옮긴다). */
    const inputFrom = (d: GarmentDetail, g: Garment, patch: Partial<Garment>) => {
      const next = { ...g, ...patch };
      const s = d.summary;
      const sameMaterial = (patch.material ?? g.material ?? '') === (s.materials.length ? materialText(s.materials) : '');
      return {
        name: next.name,
        brand: next.brand ?? null,
        productCode: d.productCode,
        colorName: next.color || null,
        colorHex: /^#[0-9a-fA-F]{6}$/.test(next.hex) ? next.hex : null,
        sizeLabel: next.size ?? null,
        origin: d.origin,
        subType: subTypeFor(next.category, next.shape, s),
        wearFrequency: s.wearFrequency,
        seasons: seasonCodes(next.seasons),
        collections: s.collections,
        materials: sameMaterial ? d.materials.map((m) => ({ part: m.part, fiber: m.fiber, percent: m.percent })) : parseMaterials(next.material ?? ''),
        careLines: d.careLines,
        measurements: d.measurements.map((m) => ({ part: m.part, kind: m.kind, valueCm: m.valueCm, source: m.source })),
        usableWhenPending: d.usableWhenPending,
        memo: next.memo ?? null,
      };
    };

    return {
      garments,
      spaces: snap.spaces,
      careLog: snap.careLog,
      get: (id) => garments.find((g) => g.id === id),

      add: async (input, opts = {}) => {
        // 원본 → 등록 → 정리본 기록 순서. 정리본만 있으면 그것을 원본 자리에 올린다.
        const first = opts.original ?? opts.photo;
        const up = first ? await upload(first) : null;
        let d = await api.post<GarmentDetail>('/api/garments', {
          name: input.name,
          brand: input.brand ?? null,
          colorName: input.color || null,
          colorHex: /^#[0-9a-fA-F]{6}$/.test(input.hex) ? input.hex : null,
          sizeLabel: input.size ?? null,
          subType: subTypeFor(input.category, input.shape),
          seasons: seasonCodes(input.seasons),
          materials: parseMaterials(input.material ?? ''),
          memo: input.memo ?? null,
          imageIds: up ? [up.id] : [],
          coverImageId: up?.id ?? null,
          spaceId: input.loc ? leaf(input.loc) : null,
          extractionId: opts.extractionId ?? null,
          searchId: opts.searchId ?? null,
          candidateId: opts.candidateId ?? null,
        });
        if (up && opts.original && opts.photo) {
          const form = new FormData();
          form.append('file', opts.photo, 'processed.png');
          d = await api.post<GarmentDetail>(`/api/garments/${d.summary.id}/images/${up.id}/processing`, form).catch(() => d);
        }
        const id = String(d.summary.id);
        const url = d.summary.imageUrl;
        if (input.photo && url) setMeta((m) => ({ ...m, [id]: { ...input.photo!, src: url } }));
        await reload().catch(() => {});
        return { ...input, id, createdAt: Date.now() };
      },

      update: async (id, patch) => {
        const g = garments.find((x) => x.id === id);
        if (!g) return;
        const { photo, care, ...fields } = patch;
        if (photo && g.photo) setMeta((m) => ({ ...m, [id]: { ...photo, src: g.photo!.src } }));
        if ('care' in patch && care) {
          await write(() =>
            g.care?.id
              ? api.patch(`/api/care/${g.care.id}`, { careType: care.kind === '세탁' ? 'WASH' : 'REPAIR', shopName: care.vendor ?? '', dueOn: care.due })
              : api.post(`/api/garments/${id}/care`, {
                  careType: care.kind === '세탁' ? 'WASH' : 'REPAIR',
                  place: care.place === '자택' ? 'HOME' : 'SHOP',
                  shopName: care.place === '업체' ? care.vendor ?? null : null,
                  droppedOn: care.since ?? isoDay(0),
                  dueOn: care.due,
                }),
          );
        }
        if (Object.keys(fields).length) {
          await write(async () => {
            const d = await api.get<GarmentDetail>(`/api/garments/${id}`);
            await api.put(`/api/garments/${id}`, inputFrom(d, g, fields));
          });
        }
      },

      remove: async (id) => {
        await write(() => api.del(`/api/garments/${id}`));
        setMeta((m) => {
          const n = { ...m };
          delete n[id];
          return n;
        });
      },

      move: async (ids, loc) => {
        await write(() => putInto(leaf(loc), ids));
      },

      place: async (items) => {
        const groups = new Map<number, string[]>();
        await write(async () => {
          items.forEach((i) => groups.set(leaf(i.loc), [...(groups.get(leaf(i.loc)) ?? []), i.id]));
          for (const [spaceId, ids] of groups) await putInto(spaceId, ids);
        });
      },

      addSpace: async (space) => {
        const name = space.name.trim();
        if (!name) return '공간 이름을 입력해 주세요';
        if (!Number.isFinite(space.capacity) || space.capacity < 1) return '수용 개수는 1 이상이어야 해요';
        if (snap.spaces.some((s) => s.name === name)) return '같은 이름의 공간이 이미 있어요';
        const spaceType = spaceTypeOf(space.kind);
        return write(async () => {
          const before = new Set([...snap.topOf.values()].map((t) => t.id));
          const map = await api.post<MapView>('/api/spaces', { name, parentId: null, spaceType, capacity: space.capacity });
          const created = map.spaces.find((s) => s.parentId == null && s.name === name && !before.has(s.id));
          if (!created) return;
          for (const slot of space.slots) await api.post('/api/spaces', { name: slot, parentId: created.id, spaceType, capacity: null });
        }, true);
      },

      removeSpace: async (name) => {
        if (garments.some((g) => g.loc?.space === name)) return '옷이 들어 있는 공간은 지울 수 없어요';
        const top = snap.topOf.get(name);
        if (!top) return null;
        // 안쪽 공간부터 지운다(서버는 안쪽 공간이 남은 공간을 지우지 않는다)
        return write(async () => {
          for (const child of top.children) await api.del(`/api/spaces/${child}`);
          await api.del(`/api/spaces/${top.id}`);
        }, true);
      },

      completeCare: async (garmentId) => {
        const g = garments.find((x) => x.id === garmentId);
        if (!g?.care?.id) return;
        await write(() => api.post(`/api/care/${g.care!.id}/complete`));
      },

      setDue: async (garmentId, due) => {
        const g = garments.find((x) => x.id === garmentId);
        if (!g?.care?.id) return '진행 중인 기록이 없어요';
        if (!due) return '날짜를 골라 주세요';
        if (g.care.since && due < g.care.since) return '회수 예정일은 맡긴 날보다 앞설 수 없어요';
        return write(() => api.patch(`/api/care/${g.care!.id}`, { dueOn: due }), true);
      },
    };
  }, [snap, meta, reload, write]);

  if (!value) {
    return (
      <div className="page notfound" role={failed ? 'alert' : 'status'}>
        <h1>{failed ? '옷장을 불러오지 못했어요' : '옷장을 불러오는 중이에요'}</h1>
        <p>{failed || '잠시만 기다려 주세요.'}</p>
        {failed && <button className="btn btn-primary" onClick={() => { setFailed(''); reload().catch((e) => setFailed(errorText(e))); }}>다시 시도</button>}
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

async function upload(blob: Blob) {
  const form = new FormData();
  form.append('file', blob, blob.type === 'image/png' ? 'photo.png' : 'photo.jpg');
  return api.post<{ id: number; url: string }>('/api/images', form);
}

export function useGarments() {
  const v = useContext(Ctx);
  if (!v) throw new Error('GarmentsProvider 안에서만 사용할 수 있어요');
  return v;
}
