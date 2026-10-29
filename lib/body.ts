import type { Body } from "./types";

/** 체형을 등록하지 않았을 때 마네킹이 쓰는 기본값 */
export const DEFAULT_BODY: Body = { heightCm: 170, weightKg: 60 };

export const HEIGHT_RANGE = { min: 100, max: 230 } as const;
export const WEIGHT_RANGE = { min: 20, max: 200 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function bmiOf(b: Body): number {
  const m = b.heightCm / 100;
  return b.weightKg / (m * m);
}

/**
 * 키와 몸무게로 마네킹 모양을 정한다.
 * - sy: 세로 배율. 190cm 이상은 화면을 꽉 채우고, 작을수록 아래(발 기준)에서부터 줄어든다.
 * - wf: 가로 폭 배율. BMI 21.5(키 170cm·몸무게 약 62kg)를 1로 두고 BMI가 높을수록 넓어진다.
 */
export function bodyShape(b: Body) {
  const sy = clamp(b.heightCm / 190, 0.6, 1);
  const wf = clamp(1 + (bmiOf(b) - 21.5) * 0.035, 0.78, 1.55);
  /** 폭 배율을 부위마다 다른 강도(p)로 적용한다 (p=1이면 wf 그대로) */
  const k = (p: number) => 1 + (wf - 1) * p;
  return { sy, wf, k };
}

/** 입력 문자열 → 검증된 체형. 틀리면 칸별 오류 문구를 돌려준다. */
export function parseBody(height: string, weight: string): { body?: Body; heightError?: string; weightError?: string } {
  const h = Number(height.replace(",", "."));
  const w = Number(weight.replace(",", "."));
  const heightError =
    !height.trim() || !Number.isFinite(h) || h < HEIGHT_RANGE.min || h > HEIGHT_RANGE.max
      ? `키를 ${HEIGHT_RANGE.min}~${HEIGHT_RANGE.max}cm 사이로 입력해 주세요.`
      : undefined;
  const weightError =
    !weight.trim() || !Number.isFinite(w) || w < WEIGHT_RANGE.min || w > WEIGHT_RANGE.max
      ? `몸무게를 ${WEIGHT_RANGE.min}~${WEIGHT_RANGE.max}kg 사이로 입력해 주세요.`
      : undefined;
  if (heightError || weightError) return { heightError, weightError };
  return { body: { heightCm: Math.round(h * 10) / 10, weightKg: Math.round(w * 10) / 10 } };
}
