"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { Screen } from "@/components/layout/Screen";
import { TopBar } from "@/components/layout/TopBar";
import { Mannequin } from "@/components/outfit/Mannequin";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { HEIGHT_RANGE, parseBody, WEIGHT_RANGE } from "@/lib/body";

const inputCls =
  "h-[46px] w-full rounded-[14px] border border-line bg-card px-3.5 pr-11 text-base outline-none placeholder:text-muted focus:border-primary";

/** 내 체형: 키·몸무게를 등록하면 코디 마네킹이 그 체형으로 보인다 (목업 없음) */
export default function BodyPage() {
  const router = useRouter();
  const toast = useToast();
  const { ready, profile, setBody } = useData();
  const saved = profile.body;

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [tried, setTried] = useState(false);

  // 저장된 값을 다 읽은 뒤(ready) 한 번만 채운다
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (!ready || filled) return;
    setFilled(true);
    if (saved) {
      setHeight(String(saved.heightCm));
      setWeight(String(saved.weightKg));
    }
  }, [ready, saved, filled]);

  const parsed = useMemo(() => parseBody(height, weight), [height, weight]);

  const back = () => (window.history.length > 1 ? router.back() : router.replace("/my"));

  const save = async () => {
    setTried(true);
    if (!parsed.body) return;
    await setBody(parsed.body);
    toast("체형을 저장했어요");
    back();
  };

  const clear = async () => {
    await setBody(null);
    setHeight("");
    setWeight("");
    setTried(false);
    toast("체형을 지웠어요");
  };

  const Field = ({
    id,
    label,
    unit,
    value,
    onChange,
    error,
    placeholder,
  }: {
    id: string;
    label: string;
    unit: string;
    value: string;
    onChange: (v: string) => void;
    error?: string;
    placeholder: string;
  }) => (
    <div className="px-5 pt-4">
      <label htmlFor={id} className="mb-[7px] block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={tried && !!error}
          className={inputCls + (tried && error ? " border-deep" : "")}
        />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-sub">{unit}</span>
      </div>
      {tried && error && <p className="mt-1.5 text-[13px] text-deep">{error}</p>}
    </div>
  );

  return (
    <Screen
      bottomBar={
        <Button size="lg" className="flex-1" onClick={save}>
          저장
        </Button>
      }
    >
      <TopBar title="내 체형" fallbackHref="/my" />
      <p className="px-5 pt-2 text-[13.5px] leading-normal text-sub">
        키와 몸무게를 등록하면
        <br />
        코디 마네킹이 내 체형으로 보여요.
      </p>

      <div className="mx-4 mt-3 flex justify-center rounded-card-lg border border-line bg-card py-3">
        <Mannequin body={parsed.body ?? saved} height={250} />
      </div>

      <Field id="body-height" label="키" unit="cm" value={height} onChange={setHeight} error={parsed.heightError} placeholder="예: 165" />
      <Field id="body-weight" label="몸무게" unit="kg" value={weight} onChange={setWeight} error={parsed.weightError} placeholder="예: 54" />

      <p className="px-5 pt-3 text-[13px] text-sub">
        입력한 값은 이 기기에만 저장돼요.
        <br />
        마네킹은 대략적인 모양을 보여 주는 용도예요.
      </p>

      {saved && (
        <button type="button" className="mx-5 mt-2 mb-4 h-11 text-sm text-sub underline underline-offset-2" onClick={clear}>
          체형 지우기
        </button>
      )}
      <div className="h-2" />
      {/* 키 범위 안내는 오류 문구로만 보여 준다 */}
      <span className="sr-only">
        키 {HEIGHT_RANGE.min}~{HEIGHT_RANGE.max}cm, 몸무게 {WEIGHT_RANGE.min}~{WEIGHT_RANGE.max}kg
      </span>
    </Screen>
  );
}
