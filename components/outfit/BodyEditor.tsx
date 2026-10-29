"use client";

import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { parseBody, previewBody } from "@/lib/body";

/**
 * 코디 탭에서 키·몸무게를 입력하는 상태.
 * 올바른 값이면 잠시 뒤 자동으로 저장하고, 입력하는 동안 마네킹이 바로 바뀌도록 파싱 결과를 돌려준다.
 */
export function useBodyDraft() {
  const { ready, profile, setBody } = useData();
  const saved = profile.body;
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [touched, setTouched] = useState(false);
  const [filled, setFilled] = useState(false);

  // 저장된 값을 다 읽은 뒤(ready) 한 번만 채운다
  useEffect(() => {
    if (!ready || filled) return;
    setFilled(true);
    if (saved) {
      setHeight(String(saved.heightCm));
      setWeight(String(saved.weightKg));
    }
  }, [ready, saved, filled]);

  const parsed = useMemo(() => parseBody(height, weight), [height, weight]);
  const preview = useMemo(() => previewBody(height, weight, saved), [height, weight, saved]);

  useEffect(() => {
    if (!touched || !parsed.body) return;
    const b = parsed.body;
    if (saved && saved.heightCm === b.heightCm && saved.weightKg === b.weightKg) return;
    const t = setTimeout(() => setBody(b), 500);
    return () => clearTimeout(t);
  }, [touched, parsed.body, saved, setBody]);

  return {
    height,
    weight,
    setHeight: (v: string) => {
      setTouched(true);
      setHeight(v);
    },
    setWeight: (v: string) => {
      setTouched(true);
      setWeight(v);
    },
    touched,
    parsed,
    preview,
    saved,
    clear: async () => {
      await setBody(null);
      setHeight("");
      setWeight("");
      setTouched(false);
    },
  };
}

export type BodyDraft = ReturnType<typeof useBodyDraft>;

const inputCls =
  "h-11 w-full rounded-[14px] border border-line bg-card px-3.5 pr-10 text-base outline-none placeholder:text-muted focus:border-primary";

/**
 * 입력칸 하나. 반드시 컴포넌트 밖에 둔다 — 안에 두면 글자를 칠 때마다 새 컴포넌트로 보여서
 * 입력칸이 다시 만들어지고 커서(포커스)가 사라진다.
 */
function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  invalid: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={invalid}
          className={inputCls + (invalid ? " border-deep" : "")}
        />
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-sub">{unit}</span>
      </div>
    </div>
  );
}

/** 키·몸무게 입력 (코디 마네킹 아래) */
export function BodyFields({ draft }: { draft: BodyDraft }) {
  const { height, weight, setHeight, setWeight, touched, parsed, saved, clear } = draft;
  const hasInput = height.trim() !== "" || weight.trim() !== "";
  const invalid = touched && hasInput && !parsed.body;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          id="body-height"
          label="키"
          unit="cm"
          value={height}
          onChange={setHeight}
          placeholder="예: 165"
          invalid={invalid && !!parsed.heightError}
        />
        <NumberField
          id="body-weight"
          label="몸무게"
          unit="kg"
          value={weight}
          onChange={setWeight}
          placeholder="예: 54"
          invalid={invalid && !!parsed.weightError}
        />
      </div>
      {invalid && (
        <p className="mt-1.5 text-[13px] text-deep">
          {[parsed.heightError, parsed.weightError].filter(Boolean).join(" ")}
        </p>
      )}
      <p className="mt-2 flex items-center justify-between text-[13px] text-sub">
        <span>입력하면 이 기기에 자동으로 저장돼요.</span>
        {saved && (
          <button type="button" className="underline underline-offset-2" onClick={clear}>
            지우기
          </button>
        )}
      </p>
    </div>
  );
}
