import Link from "next/link";
import { GarmentPhoto } from "@/components/garment/GarmentPhoto";
import { ChevronRightIcon } from "@/components/icons";
import type { Garment, Outfit } from "@/lib/types";

/** 구성 옷 순서대로 (아우터·상의·하의·신발·기타) */
export function outfitGarments(o: Outfit, byId: Map<string, Garment>): Garment[] {
  const order = ["outer", "top", "bottom", "shoes", "etc"] as const;
  return order.map((k) => (o.slots[k] ? byId.get(o.slots[k]!) : undefined)).filter((g): g is Garment => !!g);
}

/** 저장한 코디 카드 (목업 없음). 구성 옷 썸네일을 나란히 보여 준다. */
export function OutfitCard({ outfit, byId }: { outfit: Outfit; byId: Map<string, Garment> }) {
  const items = outfitGarments(outfit, byId);
  return (
    <Link href={`/outfits/${outfit.id}`} className="block rounded-card-lg border border-line bg-card px-4 py-3.5">
      <div className="flex items-center justify-between">
        <span className="min-w-0">
          <b className="block truncate text-base font-semibold tracking-[-0.02em]">{outfit.name}</b>
          <span className="mt-0.5 block truncate text-caption text-sub">
            {[`옷 ${items.length}벌`, outfit.memo].filter(Boolean).join(" · ")}
          </span>
        </span>
        <ChevronRightIcon size={20} className="flex-none text-[#A9A69F]" />
      </div>
      <div className="mt-3 flex gap-2">
        {items.map((g) => (
          <span key={g.id} className="flex size-[60px] items-center justify-center rounded-xl bg-tile">
            <GarmentPhoto src={g.photoUrl} alt={g.name} size={46} />
          </span>
        ))}
      </div>
    </Link>
  );
}
