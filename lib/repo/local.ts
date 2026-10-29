import { SEED_GARMENTS, SEED_OUTFITS, SEED_PLACES, SEED_PROFILE } from "../mock/seed";
import type { Garment, Outfit, Place, Profile } from "../types";
import type { Repos } from "./types";

/** 목업 데이터로 시작해서, 바뀐 내용을 localStorage에 저장하는 구현 (CLAUDE.md 9절 1번) */

const DB_KEY = "closet.db";
const DB_VERSION = 1;

interface Db {
  version: number;
  garments: Garment[];
  places: Place[];
  outfits: Outfit[];
  profile: Profile;
}

function seed(): Db {
  return {
    version: DB_VERSION,
    garments: structuredClone(SEED_GARMENTS),
    places: structuredClone(SEED_PLACES),
    outfits: structuredClone(SEED_OUTFITS),
    profile: { ...SEED_PROFILE },
  };
}

let db: Db | null = null;

function load(): Db {
  if (db) return db;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(DB_KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as Db) : null;
    db = parsed && parsed.version === DB_VERSION ? parsed : seed();
  } catch {
    db = seed();
  }
  return db;
}

/** 저장에 실패하면(주로 용량 초과) 이 이벤트를 보낸다. 바뀐 내용은 이번 접속 동안 메모리에는 남는다. */
export const SAVE_FAILED_EVENT = "closet:save-failed";

function save() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    window.dispatchEvent(new Event(SAVE_FAILED_EVENT));
  }
}

const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const now = () => new Date().toISOString();
const clone = <T,>(v: T): T => structuredClone(v);

function mustFind<T extends { id: string }>(list: T[], id: string): T {
  const item = list.find((x) => x.id === id);
  if (!item) throw new Error(`not found: ${id}`);
  return item;
}

export const localRepos: Repos = {
  garments: {
    async list() {
      return clone(load().garments);
    },
    async get(id) {
      const g = load().garments.find((x) => x.id === id);
      return g ? clone(g) : null;
    },
    async create(input) {
      const at = now();
      const g: Garment = { ...input, id: newId("g"), createdAt: at, updatedAt: at };
      load().garments.unshift(g);
      save();
      return clone(g);
    },
    async update(id, patch) {
      const g = mustFind(load().garments, id);
      // 위치를 직접 바꾸면 다시 찾아온 것으로 본다
      if (g.outing && patch.placeId !== undefined && patch.placeId !== g.placeId) delete g.outing;
      Object.assign(g, patch, { updatedAt: now() });
      if (!g.outing) delete g.outing;
      save();
      return clone(g);
    },
    async remove(id) {
      const d = load();
      d.garments = d.garments.filter((g) => g.id !== id);
      // 삭제한 옷은 코디에서도 빠진다
      for (const o of d.outfits) {
        for (const k of Object.keys(o.slots) as (keyof Outfit["slots"])[]) {
          if (o.slots[k] === id) delete o.slots[k];
        }
      }
      save();
    },
    async movePlace(ids, placeId) {
      const set = new Set(ids);
      const at = now();
      const moved: Garment[] = [];
      for (const g of load().garments) {
        if (set.has(g.id)) {
          g.placeId = placeId;
          delete g.outing;
          g.updatedAt = at;
          moved.push(g);
        }
      }
      save();
      return clone(moved);
    },
    async sendOut(id, input) {
      const d = load();
      const g = mustFind(d.garments, id);
      const placeName = input.kind === "laundry" ? "세탁소" : "수선집";
      let place = d.places.find((p) => !p.parentId && p.name === placeName);
      if (!place) {
        place = { id: newId("p"), name: placeName };
        d.places.push(place);
      }
      const at = now();
      g.outing = {
        ...input,
        previousPlaceId: g.outing ? g.outing.previousPlaceId : g.placeId,
        since: g.outing ? g.outing.since : at,
      };
      g.placeId = place.id;
      g.updatedAt = at;
      save();
      return clone(g);
    },
    async bringBack(id, placeId) {
      const g = mustFind(load().garments, id);
      delete g.outing;
      g.placeId = placeId;
      g.updatedAt = now();
      save();
      return clone(g);
    },
  },

  places: {
    async list() {
      return clone(load().places);
    },
    async create(input) {
      const p: Place = { ...input, id: newId("p") };
      load().places.push(p);
      save();
      return clone(p);
    },
    async rename(id, name) {
      const p = mustFind(load().places, id);
      p.name = name;
      save();
      return clone(p);
    },
    async remove(id) {
      const d = load();
      const gone = new Set([id, ...d.places.filter((p) => p.parentId === id).map((p) => p.id)]);
      d.places = d.places.filter((p) => !gone.has(p.id));
      for (const g of d.garments) if (g.placeId && gone.has(g.placeId)) g.placeId = null;
      save();
    },
  },

  outfits: {
    async list() {
      return clone(load().outfits);
    },
    async create(input) {
      const o: Outfit = { ...input, id: newId("o"), createdAt: now() };
      load().outfits.unshift(o);
      save();
      return clone(o);
    },
    async update(id, patch) {
      const o = mustFind(load().outfits, id);
      Object.assign(o, patch);
      save();
      return clone(o);
    },
    async remove(id) {
      const d = load();
      d.outfits = d.outfits.filter((o) => o.id !== id);
      save();
    },
  },

  profile: {
    async get() {
      return clone(load().profile);
    },
    async setBody(body) {
      const d = load();
      if (body) d.profile.body = body;
      else delete d.profile.body;
      save();
      return clone(d.profile);
    },
  },
};
