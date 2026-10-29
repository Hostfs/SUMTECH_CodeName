"use client";

import { useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { childPlaces, rootPlaces, UNASSIGNED_LABEL } from "@/lib/places";

/**
 * 장소 선택 바텀시트. 위치 변경(상세)과 일괄 변경(내 옷장)에서 같이 쓴다. (목업 없음)
 * 하위 칸이 있는 장소는 하위 칸만 고를 수 있다.
 */
export function PlacePickerSheet({
  open,
  onClose,
  current,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  /** 지금 위치. 여러 벌이라 정해지지 않으면 undefined */
  current?: string | null;
  onConfirm: (placeId: string | null) => void;
}) {
  const { places } = useData();
  const [picked, setPicked] = useState<string | null | undefined>(current);

  useEffect(() => {
    if (open) setPicked(current);
  }, [open, current]);

  const Row = ({ id, label, indent }: { id: string | null; label: string; indent?: boolean }) => {
    const on = picked === id;
    return (
      <button
        type="button"
        onClick={() => setPicked(id)}
        aria-pressed={on}
        className={
          "flex h-[52px] w-full items-center justify-between pr-5 text-left text-[15px] " +
          (indent ? "pl-9" : "pl-5") +
          (on ? " bg-soft font-semibold" : "")
        }
      >
        <span>{label}</span>
        <span
          className={
            "flex size-[22px] items-center justify-center rounded-full border-[1.5px] " +
            (on ? "border-primary bg-primary text-on" : "border-[#CFCCC5]")
          }
          aria-hidden
        >
          {on && <CheckIcon size={13} />}
        </span>
      </button>
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="보관 위치 선택"
      footer={
        <Button size="lg" className="w-full" disabled={picked === undefined} onClick={() => picked !== undefined && onConfirm(picked)}>
          위치 변경
        </Button>
      }
    >
      <ul>
        {rootPlaces(places).map((root) => {
          const kids = childPlaces(places, root.id);
          return (
            <li key={root.id} className="border-b border-line last:border-0">
              {kids.length === 0 ? (
                <Row id={root.id} label={root.name} />
              ) : (
                <>
                  <div className="px-5 pt-3 pb-1 text-[13px] font-semibold text-sub">{root.name}</div>
                  {kids.map((k) => (
                    <Row key={k.id} id={k.id} label={k.name} indent />
                  ))}
                </>
              )}
            </li>
          );
        })}
        <li>
          <Row id={null} label={UNASSIGNED_LABEL} />
        </li>
      </ul>
    </Sheet>
  );
}
