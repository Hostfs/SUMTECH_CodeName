import Link from "next/link";
import { CheckIcon, PinIcon } from "@/components/icons";
import type { Garment } from "@/lib/types";
import { GarmentPhoto } from "./GarmentPhoto";

/** 내 옷장 목록 카드 (design/html/closet_*.html .cardi) */
export function GarmentCard({
  garment,
  location,
  selecting,
  selected,
  highlighted,
  onToggle,
}: {
  garment: Garment;
  /** '옷장 A · 왼쪽 행거'. null이면 '위치 미지정' 배지 */
  location: string | null;
  selecting: boolean;
  selected: boolean;
  highlighted?: boolean;
  onToggle: () => void;
}) {
  const body = (
    <>
      <div
        className={
          "flex h-32 items-center justify-center rounded-tile " + (selected || highlighted ? "bg-soft" : "bg-tile")
        }
      >
        <GarmentPhoto src={garment.photoUrl} alt={garment.name} size={104} />
      </div>
      {selecting && (
        <span
          className={
            "absolute top-3.5 left-3.5 flex size-[26px] items-center justify-center rounded-full border-[1.5px] " +
            (selected ? "border-primary bg-primary text-on" : "border-[#CFCCC5] bg-white/90")
          }
          aria-hidden
        >
          {selected && <CheckIcon />}
        </span>
      )}
      <div className="mx-1 mt-[9px] truncate text-[15px] font-semibold">{garment.name}</div>
      {location ? (
        <div className="mx-1 mt-[3px] flex items-center gap-[3px] text-caption whitespace-nowrap text-sub">
          <PinIcon className="flex-none" />
          <span className="truncate">{location}</span>
        </div>
      ) : (
        <span className="mx-1 mt-[3px] inline-block rounded-full bg-nobadge px-[9px] py-0.5 text-xs text-sub">
          위치 미지정
        </span>
      )}
    </>
  );

  const cls =
    "relative block rounded-card bg-card text-left " +
    (selected || highlighted ? "border-2 border-primary px-[7px] pt-[7px] pb-[11px]" : "border border-line px-2 pt-2 pb-3");

  return selecting ? (
    <button type="button" className={cls + " w-full"} onClick={onToggle} aria-pressed={selected}>
      {body}
    </button>
  ) : (
    <Link href={`/closet/${garment.id}`} className={cls}>
      {body}
    </Link>
  );
}
