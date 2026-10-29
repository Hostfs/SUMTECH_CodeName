import { GarmentPhoto } from "@/components/garment/GarmentPhoto";
import type { Garment } from "@/lib/types";

/** 겹친 썸네일 2~3개 (storage_autumn.html .thumbs) */
export function PlaceThumbs({ garments }: { garments: Garment[] }) {
  const shown = garments.slice(0, 3);
  return (
    <div className="flex w-[86px] flex-none">
      {shown.length === 0 ? (
        <div className="size-[42px] rounded-xl border-2 border-white bg-tile shadow-[0_0_0_1px_var(--line)]" />
      ) : (
        shown.map((g, i) => (
          <div
            key={g.id}
            className={
              "flex size-[42px] items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-tile shadow-[0_0_0_1px_var(--line)] " +
              (i > 0 ? "-ml-3.5" : "")
            }
          >
            <GarmentPhoto src={g.photoUrl} alt="" size={32} />
          </div>
        ))
      )}
    </div>
  );
}
