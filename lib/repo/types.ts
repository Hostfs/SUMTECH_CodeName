import type { Garment, Outfit, Place, Profile } from "../types";

/**
 * 데이터 접근은 이 인터페이스로만 한다. 지금은 localStorage 구현(local.ts)을 쓰고,
 * 나중에 Supabase 구현으로 바꿔 끼운다. 그래서 모든 메서드는 Promise를 돌려준다.
 */

export type GarmentInput = Omit<Garment, "id" | "createdAt" | "updatedAt">;

export interface GarmentRepo {
  list(): Promise<Garment[]>;
  get(id: string): Promise<Garment | null>;
  create(input: GarmentInput): Promise<Garment>;
  update(id: string, patch: Partial<GarmentInput>): Promise<Garment>;
  remove(id: string): Promise<void>;
  /** 여러 벌의 보관 위치를 한 번에 바꾼다. placeId null = 위치 미지정 */
  movePlace(ids: string[], placeId: string | null): Promise<Garment[]>;
}

export interface PlaceRepo {
  list(): Promise<Place[]>;
  create(input: Omit<Place, "id">): Promise<Place>;
  rename(id: string, name: string): Promise<Place>;
  /** 장소와 하위 칸을 지우고, 그 안의 옷은 '미지정'으로 바꾼다 */
  remove(id: string): Promise<void>;
}

export interface OutfitRepo {
  list(): Promise<Outfit[]>;
  create(input: Omit<Outfit, "id" | "createdAt">): Promise<Outfit>;
  update(id: string, patch: Partial<Omit<Outfit, "id" | "createdAt">>): Promise<Outfit>;
  remove(id: string): Promise<void>;
}

export interface ProfileRepo {
  get(): Promise<Profile>;
}

export interface Repos {
  garments: GarmentRepo;
  places: PlaceRepo;
  outfits: OutfitRepo;
  profile: ProfileRepo;
}
