"use client";

import { useRef, useState } from "react";
import { useData } from "@/components/DataProvider";
import { CameraIcon, ChevronDownIcon, PinIcon } from "@/components/icons";
import { Screen } from "@/components/layout/Screen";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { fileToPreviewUrl } from "@/lib/image";
import { childPlaces, rootPlaces } from "@/lib/places";
import type { GarmentInput } from "@/lib/repo";
import { SEASON_LABEL, SEASONS } from "@/lib/theme";
import { CATEGORIES, CATEGORY_LABEL, COLOR_SWATCHES, type Garment } from "@/lib/types";
import { CutoutThumb } from "./CutoutThumb";

type PhotoState = "empty" | "ready" | "error";

const EMPTY: GarmentInput = { name: "", category: "top", color: "", seasons: [], placeId: null };

/** 옷 등록·수정 공용 폼 (design/html/add_autumn.html) */
export function GarmentForm({
  initial,
  title,
  onSubmit,
  onCancel,
}: {
  initial?: Garment;
  title: string;
  onSubmit: (input: GarmentInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { places } = useData();
  const [v, setV] = useState<GarmentInput>(() => (initial ? { ...EMPTY, ...stripMeta(initial) } : EMPTY));
  const [photo, setPhoto] = useState<PhotoState>(initial?.photoUrl ? "ready" : "empty");
  const [nameError, setNameError] = useState(false);
  const [moreOpen, setMoreOpen] = useState(
    Boolean(initial && (initial.brand || initial.size || initial.material || initial.memo)),
  );
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof GarmentInput>(k: K, val: GarmentInput[K]) => setV((s) => ({ ...s, [k]: val }));

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      set("photoUrl", await fileToPreviewUrl(file));
      setPhoto("ready");
    } catch {
      setPhoto("error");
    }
  };

  const submit = async () => {
    if (!v.name.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...v, name: v.name.trim() });
    } finally {
      setSaving(false);
    }
  };

  const swatch = COLOR_SWATCHES.find((c) => c.name === v.color);

  return (
    <Screen
      bottomBar={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onCancel}>
            취소
          </Button>
          <Button size="lg" className="flex-[2]" onClick={submit} disabled={saving}>
            저장
          </Button>
        </>
      }
    >
      <TopBar title={title} />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {/* 사진 */}
      <div className="mx-4 mt-2 flex items-center gap-3.5 px-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={photo === "ready" ? "사진 다시 선택" : "사진 올리기"}
          className={
            "flex size-[104px] flex-none items-center justify-center overflow-hidden rounded-card bg-card " +
            (photo === "ready" ? "border border-line" : "border border-dashed border-dash text-sub")
          }
        >
          {photo === "ready" ? (
            <CutoutThumb src={v.photoUrl} size={84} />
          ) : (
            <CameraIcon size={28} />
          )}
        </button>
        <div className="min-w-0">
          {photo === "error" ? (
            <>
              <b className="block text-[15px] font-semibold">사진을 올리지 못했어요.</b>
              <span className="mt-[3px] mb-2.5 block text-caption text-sub">다시 시도해 주세요.</span>
              <span className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  다시 시도
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPhoto("empty")}>
                  사진 없이 등록
                </Button>
              </span>
            </>
          ) : (
            <>
              <b className="block text-[15px] font-semibold">{photo === "ready" ? "사진을 올렸어요" : "사진 올리기"}</b>
              <span className="mt-[3px] mb-2.5 block text-caption text-sub">옷 전체가 보이는 사진이 좋아요</span>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                {photo === "ready" ? "다시 선택" : "사진 선택"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Field label="이름" htmlFor="g-name">
        <input
          id="g-name"
          ref={nameRef}
          value={v.name}
          onChange={(e) => {
            set("name", e.target.value);
            if (e.target.value.trim()) setNameError(false);
          }}
          placeholder="예: 브라운 니트"
          aria-invalid={nameError}
          aria-describedby={nameError ? "g-name-err" : undefined}
          className={inputCls + (nameError ? " border-deep" : "")}
        />
        {nameError && (
          // 오류 색은 아직 정하지 않아 임시로 --deep을 쓴다 (screens.md 4절)
          <p id="g-name-err" className="mt-1.5 text-[13px] text-deep">
            이름을 입력해 주세요.
          </p>
        )}
      </Field>

      <Field label="종류">
        <div className="flex gap-2">
          {CATEGORIES.map((c) => (
            <SegChip key={c} on={v.category === c} onClick={() => set("category", c)}>
              {CATEGORY_LABEL[c]}
            </SegChip>
          ))}
        </div>
      </Field>

      <Field label="색상" hint={v.color || undefined}>
        <div className="flex items-center gap-3">
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c.name}
              type="button"
              aria-label={c.name}
              aria-pressed={swatch?.name === c.name}
              onClick={() => set("color", v.color === c.name ? "" : c.name)}
              className={
                "size-[30px] flex-none rounded-full border border-black/12 " +
                (swatch?.name === c.name ? "shadow-[0_0_0_3px_var(--bg),0_0_0_5px_var(--primary)]" : "")
              }
              style={{ background: c.hex }}
            />
          ))}
        </div>
      </Field>

      <Field label="계절" hint="여러 개 선택할 수 있어요">
        <div className="flex gap-2">
          {SEASONS.map((s) => (
            <SegChip
              key={s}
              on={v.seasons.includes(s)}
              onClick={() =>
                // 연달아 눌러도 최신 값 기준으로 토글한다
                setV((cur) => ({
                  ...cur,
                  seasons: cur.seasons.includes(s) ? cur.seasons.filter((x) => x !== s) : [...cur.seasons, s],
                }))
              }
            >
              {SEASON_LABEL[s]}
            </SegChip>
          ))}
        </div>
      </Field>

      <Field label="보관 위치" hint="모르면 ‘미지정’" htmlFor="g-place">
        <div className="relative">
          <PinIcon size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" />
          <select
            id="g-place"
            value={v.placeId ?? ""}
            onChange={(e) => set("placeId", e.target.value || null)}
            className={inputCls + " appearance-none pr-10 pl-[40px]" + (v.placeId ? "" : " text-muted")}
          >
            <option value="">미지정</option>
            {rootPlaces(places).map((root) => {
              const kids = childPlaces(places, root.id);
              return kids.length === 0 ? (
                <option key={root.id} value={root.id}>
                  {root.name}
                </option>
              ) : (
                <optgroup key={root.id} label={root.name}>
                  {kids.map((k) => (
                    <option key={k.id} value={k.id}>
                      {root.name} › {k.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <ChevronDownIcon size={20} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink" />
        </div>
      </Field>

      <button
        type="button"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((o) => !o)}
        className="mx-5 mt-3 flex h-10 w-[calc(100%-40px)] items-center justify-between text-sm font-semibold text-deep"
      >
        자세한 정보 {moreOpen ? "접기" : "추가"}
        <span className="text-caption font-normal text-sub">브랜드·사이즈·소재·메모</span>
      </button>

      {moreOpen && (
        <div className="pb-4">
          <Field label="브랜드" htmlFor="g-brand">
            <input id="g-brand" value={v.brand ?? ""} onChange={(e) => set("brand", e.target.value || undefined)} className={inputCls} />
          </Field>
          <Field label="사이즈" htmlFor="g-size">
            <input id="g-size" value={v.size ?? ""} onChange={(e) => set("size", e.target.value || undefined)} className={inputCls} />
          </Field>
          <Field label="소재" htmlFor="g-material">
            <input
              id="g-material"
              value={v.material ?? ""}
              onChange={(e) => set("material", e.target.value || undefined)}
              className={inputCls}
            />
          </Field>
          <Field label="메모" htmlFor="g-memo">
            <input id="g-memo" value={v.memo ?? ""} onChange={(e) => set("memo", e.target.value || undefined)} className={inputCls} />
          </Field>
        </div>
      )}
      <div className="h-4" />
    </Screen>
  );
}

const inputCls =
  "h-[46px] w-full rounded-[14px] border border-line bg-card px-3.5 text-base outline-none placeholder:text-muted focus:border-primary";

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 pt-3">
      <label htmlFor={htmlFor} className="mb-[7px] flex justify-between text-sm font-semibold">
        {label}
        {hint && <span className="text-[13px] font-normal text-sub">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

/** 폭을 나눠 갖는 칩 (등록 화면 .chips2) */
function SegChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={
        "flex h-[38px] flex-1 items-center justify-center rounded-full border text-sm whitespace-nowrap " +
        (on ? "border-primary bg-primary font-semibold text-on" : "border-line bg-card text-ink")
      }
    >
      {children}
    </button>
  );
}

function stripMeta(g: Garment): GarmentInput {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, createdAt, updatedAt, ...rest } = g;
  return rest;
}
