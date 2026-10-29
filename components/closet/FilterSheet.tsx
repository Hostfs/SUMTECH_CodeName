"use client";

import { useMemo } from "react";
import { useData } from "@/components/DataProvider";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { EMPTY_QUERY, type ClosetQuery, type PlaceFilter } from "@/lib/closet-query";
import { rootPlaces, UNASSIGNED_LABEL } from "@/lib/places";
import { SEASON_LABEL, SEASONS } from "@/lib/theme";
import { CATEGORIES, CATEGORY_LABEL, COLOR_SWATCHES } from "@/lib/types";

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** 필터 시트: 종류·계절·색상·보관 위치 (목업 없음). 고르는 즉시 목록에 반영한다. */
export function FilterSheet({
  open,
  onClose,
  query,
  onChange,
  resultCount,
}: {
  open: boolean;
  onClose: () => void;
  query: ClosetQuery;
  onChange: (q: ClosetQuery) => void;
  resultCount: number;
}) {
  const { garments, places } = useData();

  // 색 점 8개 + 데이터에만 있는 색 이름
  const colors = useMemo(() => {
    const known = new Map(COLOR_SWATCHES.map((c) => [c.name, c.hex]));
    const extra = [...new Set(garments.map((g) => g.color))].filter((c) => !known.has(c));
    return [...COLOR_SWATCHES, ...extra.map((name) => ({ name, hex: undefined as string | undefined }))];
  }, [garments]);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="px-5 pt-3 pb-2">
      <h3 className="text-sm font-semibold text-sub">{title}</h3>
      <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>
    </section>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="필터"
      footer={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => onChange({ ...EMPTY_QUERY, q: query.q, sort: query.sort })}
          >
            필터 초기화
          </Button>
          <Button size="lg" className="flex-[1.4]" onClick={onClose}>
            {resultCount}벌 보기
          </Button>
        </div>
      }
    >
      <Section title="종류">
        <Chip selected={query.category === "all"} onClick={() => onChange({ ...query, category: "all" })}>
          전체
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={query.category === c} onClick={() => onChange({ ...query, category: c })}>
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </Section>
      <Section title="계절">
        {SEASONS.map((s) => (
          <Chip
            key={s}
            selected={query.seasons.includes(s)}
            onClick={() => onChange({ ...query, seasons: toggle(query.seasons, s) })}
          >
            {SEASON_LABEL[s]}
          </Chip>
        ))}
      </Section>
      <Section title="색상">
        {colors.map((c) => (
          <Chip
            key={c.name}
            selected={query.colors.includes(c.name)}
            onClick={() => onChange({ ...query, colors: toggle(query.colors, c.name) })}
          >
            {c.hex && (
              <span className="size-3.5 rounded-full border border-black/10" style={{ background: c.hex }} aria-hidden />
            )}
            {c.name}
          </Chip>
        ))}
      </Section>
      <Section title="보관 위치">
        {[...rootPlaces(places).map((p) => ({ id: p.id as PlaceFilter, name: p.name })), { id: "none", name: UNASSIGNED_LABEL }].map(
          (p) => (
            <Chip
              key={p.id}
              selected={query.places.includes(p.id)}
              onClick={() => onChange({ ...query, places: toggle(query.places, p.id) })}
            >
              {p.name}
            </Chip>
          ),
        )}
      </Section>
    </Sheet>
  );
}
