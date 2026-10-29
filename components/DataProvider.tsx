"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SEED_GARMENTS, SEED_OUTFITS, SEED_PLACES, SEED_PROFILE } from "@/lib/mock/seed";
import { indexPlaces, type PlaceIndex } from "@/lib/places";
import { repos, type GarmentInput } from "@/lib/repo";
import { SAVE_FAILED_EVENT } from "@/lib/repo/local";
import { useToast } from "@/components/ui/Toast";
import type { Garment, Outfit, Place, Profile } from "@/lib/types";

/**
 * 화면들이 같은 데이터를 보도록 한곳에 모은 상태 (R09: 한 화면에서 바꾼 값이 모든 화면에 같게 보인다).
 * 쓰기는 항상 repos를 거친 뒤 상태를 갱신한다.
 */
interface DataContextValue {
  ready: boolean;
  garments: Garment[];
  places: Place[];
  placeIndex: PlaceIndex;
  outfits: Outfit[];
  profile: Profile;
  createGarment(input: GarmentInput): Promise<Garment>;
  updateGarment(id: string, patch: Partial<GarmentInput>): Promise<Garment>;
  removeGarment(id: string): Promise<void>;
  moveGarments(ids: string[], placeId: string | null): Promise<void>;
  createPlace(input: Omit<Place, "id">): Promise<Place>;
  renamePlace(id: string, name: string): Promise<void>;
  removePlace(id: string): Promise<void>;
  createOutfit(input: Omit<Outfit, "id" | "createdAt">): Promise<Outfit>;
  removeOutfit(id: string): Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  // 서버 렌더와 첫 화면은 목업 데이터로 그리고, 마운트 후 저장된 데이터로 바꾼다.
  const [ready, setReady] = useState(false);
  const [garments, setGarments] = useState<Garment[]>(SEED_GARMENTS);
  const [places, setPlaces] = useState<Place[]>(SEED_PLACES);
  const [outfits, setOutfits] = useState<Outfit[]>(SEED_OUTFITS);
  const [profile, setProfile] = useState<Profile>(SEED_PROFILE);

  const reloadGarments = useCallback(async () => setGarments(await repos.garments.list()), []);
  const reloadPlaces = useCallback(async () => setPlaces(await repos.places.list()), []);
  const reloadOutfits = useCallback(async () => setOutfits(await repos.outfits.list()), []);

  useEffect(() => {
    Promise.all([reloadGarments(), reloadPlaces(), reloadOutfits(), repos.profile.get().then(setProfile)]).then(() =>
      setReady(true),
    );
  }, [reloadGarments, reloadPlaces, reloadOutfits]);

  // 기기 저장 공간이 꽉 차서 저장하지 못했을 때 알린다
  const toast = useToast();
  useEffect(() => {
    const onFail = () => toast("저장 공간이 부족해 저장하지 못했어요", { error: true });
    window.addEventListener(SAVE_FAILED_EVENT, onFail);
    return () => window.removeEventListener(SAVE_FAILED_EVENT, onFail);
  }, [toast]);

  const placeIndex = useMemo(() => indexPlaces(places), [places]);

  const value = useMemo<DataContextValue>(
    () => ({
      ready,
      garments,
      places,
      placeIndex,
      outfits,
      profile,
      async createGarment(input) {
        const g = await repos.garments.create(input);
        await reloadGarments();
        return g;
      },
      async updateGarment(id, patch) {
        const g = await repos.garments.update(id, patch);
        await reloadGarments();
        return g;
      },
      async removeGarment(id) {
        await repos.garments.remove(id);
        await Promise.all([reloadGarments(), reloadOutfits()]);
      },
      async moveGarments(ids, placeId) {
        await repos.garments.movePlace(ids, placeId);
        await reloadGarments();
      },
      async createPlace(input) {
        const p = await repos.places.create(input);
        await reloadPlaces();
        return p;
      },
      async renamePlace(id, name) {
        await repos.places.rename(id, name);
        await reloadPlaces();
      },
      async removePlace(id) {
        await repos.places.remove(id);
        await Promise.all([reloadPlaces(), reloadGarments()]);
      },
      async createOutfit(input) {
        const o = await repos.outfits.create(input);
        await reloadOutfits();
        return o;
      },
      async removeOutfit(id) {
        await repos.outfits.remove(id);
        await reloadOutfits();
      },
    }),
    [ready, garments, places, placeIndex, outfits, profile, reloadGarments, reloadPlaces, reloadOutfits],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
