import { useId, useMemo } from 'react';

// 프론트엔드 담당 초안(otgyeol-frontend/src/components/Sky.tsx)의 날씨 하늘을 그대로 옮겼다.
// 장면은 기상청 실황(하늘 상태·강수)과 밤낮으로 정한다(WeatherCard의 skyKey).
export type SkyKind = 'clear' | 'cloudy' | 'rain' | 'snow';

// 날씨 배경. 그라데이션 하늘 + feTurbulence 로 만든 구름층(그림자 + 빛 받는 가장자리)을 겹친다.
// 실제 앱에서는 이 컴포넌트 자리에 날씨별 사진·영상을 넣어도 된다 (props 는 그대로).
const W = 400;
const H = 680;

interface Layer {
  fx: number;
  fy: number;
  seed: number;
  gain: number;
  bias: number;
  shadow: string;
  light: string;
  under?: boolean;
  op?: number;
  mask: [number, number][];
}
interface Glow { cx: number; cy: number; r: number; color: string; op: number; sy?: number }
interface Scene { stops: [number, string][]; glows?: Glow[]; layers: Layer[] }

const MASK_A: [number, number][] = [[0, 0.2], [0.3, 0.75], [0.65, 1], [1, 0.9]];
const MASK_B: [number, number][] = [[0, 0.5], [0.5, 0.9], [1, 0.5]];
const MASK_C: [number, number][] = [[0, 0.6], [0.4, 1], [1, 1]];
const MASK_D: [number, number][] = [[0, 0.9], [0.6, 1], [1, 0.7]];
const MASK_E: [number, number][] = [[0, 0.5], [0.4, 1], [0.85, 0.9], [1, 0.4]];

const SCENES: Record<string, Scene> = {
  'clear-day': {
    stops: [[0, '#5B93D1'], [0.4, '#93B9E2'], [0.75, '#D9DDE2'], [1, '#F1D6B8']],
    glows: [{ cx: 330, cy: 520, r: 280, color: '#FFE6C4', op: 0.8, sy: 0.8 }],
    layers: [
      { fx: 0.005, fy: 0.008, seed: 4, gain: 2.4, bias: -1.0, shadow: '#97AAC4', light: '#FFF7EE', mask: MASK_A },
      { fx: 0.011, fy: 0.016, seed: 11, gain: 2.0, bias: -0.88, shadow: '#B3C2D6', light: '#FFFFFF', mask: MASK_B, op: 0.85 },
    ],
  },
  'clear-night': {
    stops: [[0, '#0A1226'], [0.45, '#1B2A4E'], [0.75, '#4A4F70'], [1, '#B7745A']],
    glows: [{ cx: 340, cy: 640, r: 300, color: '#FF9A5C', op: 0.55, sy: 0.6 }],
    layers: [
      { fx: 0.0045, fy: 0.008, seed: 31, gain: 2.3, bias: -0.9, shadow: '#1A2444', light: '#F0A37C', under: true, mask: MASK_E },
      { fx: 0.01, fy: 0.016, seed: 9, gain: 2.0, bias: -0.85, shadow: '#26325A', light: '#E89A84', under: true, mask: [[0, 0.2], [0.5, 0.7], [1, 0.5]], op: 0.8 },
    ],
  },
  'cloudy-day': {
    stops: [[0, '#6F849E'], [0.5, '#A0AFC0'], [1, '#CBD0D5']],
    glows: [{ cx: 90, cy: 230, r: 220, color: '#FFF4DE', op: 0.55 }],
    layers: [
      { fx: 0.004, fy: 0.007, seed: 7, gain: 2.6, bias: -0.95, shadow: '#6E7B8D', light: '#EEF1F4', mask: MASK_C },
      { fx: 0.009, fy: 0.014, seed: 19, gain: 2.2, bias: -0.85, shadow: '#8794A5', light: '#F7F8FA', mask: [[0, 0.4], [0.6, 1], [1, 0.8]], op: 0.9 },
    ],
  },
  'cloudy-night': {
    stops: [[0, '#070B16'], [0.5, '#161E32'], [1, '#2A3144']],
    layers: [
      { fx: 0.004, fy: 0.007, seed: 17, gain: 2.5, bias: -0.92, shadow: '#0B1020', light: '#3A445E', mask: MASK_D },
      { fx: 0.009, fy: 0.014, seed: 3, gain: 2.0, bias: -0.85, shadow: '#141B2E', light: '#465270', mask: [[0, 0.3], [0.5, 0.8], [1, 0.5]], op: 0.8 },
    ],
  },
  'rain-day': {
    stops: [[0, '#5E7088'], [0.5, '#8796A8'], [1, '#B7BFC8']],
    layers: [
      { fx: 0.004, fy: 0.007, seed: 41, gain: 2.5, bias: -0.9, shadow: '#4C5C72', light: '#C9D1DA', mask: MASK_D },
      { fx: 0.009, fy: 0.014, seed: 8, gain: 2.1, bias: -0.85, shadow: '#5F6F85', light: '#D5DBE2', mask: MASK_B, op: 0.85 },
    ],
  },
  'rain-night': {
    stops: [[0, '#050913'], [0.45, '#101A2F'], [0.8, '#1E2944'], [1, '#2C3048']],
    glows: [
      { cx: 200, cy: 700, r: 340, color: '#8C5E52', op: 0.5, sy: 0.55 },
      { cx: 330, cy: 640, r: 120, color: '#C98A5A', op: 0.3 },
    ],
    layers: [
      { fx: 0.004, fy: 0.008, seed: 23, gain: 2.4, bias: -0.9, shadow: '#0A1020', light: '#2F3B58', mask: MASK_D },
      { fx: 0.009, fy: 0.016, seed: 5, gain: 2.0, bias: -0.85, shadow: '#141C30', light: '#3B4766', mask: [[0, 0.3], [0.5, 0.8], [1, 0.5]], op: 0.8 },
    ],
  },
  'snow-day': {
    stops: [[0, '#7B8FAA'], [0.55, '#A9B7C9'], [1, '#DDE3EA']],
    layers: [
      { fx: 0.004, fy: 0.007, seed: 53, gain: 2.5, bias: -0.92, shadow: '#8C9CB2', light: '#FFFFFF', mask: MASK_C },
      { fx: 0.009, fy: 0.014, seed: 14, gain: 2.0, bias: -0.85, shadow: '#9DABBE', light: '#F6F8FB', mask: MASK_B, op: 0.8 },
    ],
  },
  'snow-night': {
    stops: [[0, '#0B1430'], [0.38, '#22345E'], [0.66, '#56679A'], [0.86, '#C08C8D'], [1, '#EBA57A']],
    glows: [{ cx: 320, cy: 640, r: 300, color: '#FF9E66', op: 0.6, sy: 0.6 }],
    layers: [
      { fx: 0.0045, fy: 0.008, seed: 31, gain: 2.3, bias: -0.9, shadow: '#1A2444', light: '#F0A37C', under: true, mask: MASK_E },
      { fx: 0.01, fy: 0.016, seed: 9, gain: 2.0, bias: -0.85, shadow: '#26325A', light: '#E89A84', under: true, mask: [[0, 0.2], [0.5, 0.7], [1, 0.5]], op: 0.8 },
    ],
  },
};

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' ');
}

function cloudFilter(id: string, l: Layer, color: string, dy: number, biasAdj: number) {
  const [r, g, b] = rgb(color).split(' ');
  return (
    <filter key={id} id={id} filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H} colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency={`${l.fx} ${l.fy}`} numOctaves={6} seed={l.seed} />
      <feColorMatrix type="matrix" values={`0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${l.gain} 0 0 0 ${l.bias + biasAdj}`} />
      <feOffset dy={dy} />
    </filter>
  );
}

export function Sky({ scene }: { scene: string }) {
  const uid = useId().replace(/:/g, '');
  const s = SCENES[scene] ?? SCENES['cloudy-day'];
  return (
    <svg className="sky" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}sk`} x1="0" y1="0" x2="0" y2="1">
          {s.stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
        </linearGradient>
        {(s.glows ?? []).map((_, i) => (
          <radialGradient key={i} id={`${uid}gl${i}`}>
            <stop offset="0" stopColor={s.glows![i].color} stopOpacity={s.glows![i].op} />
            <stop offset="1" stopColor={s.glows![i].color} stopOpacity="0" />
          </radialGradient>
        ))}
        {s.layers.map((l, i) => [
          cloudFilter(`${uid}s${i}`, l, l.shadow, 0, 0),
          cloudFilter(`${uid}l${i}`, l, l.light, l.under ? 5 : -5, -0.04),
          <linearGradient key={`g${i}`} id={`${uid}g${i}`} x1="0" y1="0" x2="0" y2="1">
            {l.mask.map(([o, a]) => <stop key={o} offset={o} stopColor="#fff" stopOpacity={a} />)}
          </linearGradient>,
          <mask key={`m${i}`} id={`${uid}m${i}`}>
            <rect width={W} height={H} fill={`url(#${uid}g${i})`} />
          </mask>,
        ])}
      </defs>
      <rect width={W} height={H} fill={`url(#${uid}sk)`} />
      {(s.glows ?? []).map((g, i) => (
        <ellipse key={i} cx={g.cx} cy={g.cy} rx={g.r} ry={g.r * (g.sy ?? 1)} fill={`url(#${uid}gl${i})`} />
      ))}
      {s.layers.map((l, i) => {
        const shadow = <rect key="s" width={W} height={H} filter={`url(#${uid}s${i})`} />;
        const light = <rect key="l" width={W} height={H} filter={`url(#${uid}l${i})`} />;
        return (
          <g key={i} mask={`url(#${uid}m${i})`} opacity={l.op ?? 1}>
            {l.under ? [light, shadow] : [shadow, light]}
          </g>
        );
      })}
    </svg>
  );
}

// 비·눈 입자는 흐리지 않고 또렷하게 얹는다.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Precip({ kind }: { kind: SkyKind }) {
  const items = useMemo(() => {
    if (kind !== 'rain' && kind !== 'snow') return [];
    const r = rng(kind === 'rain' ? 99 : 42);
    return Array.from({ length: kind === 'rain' ? 110 : 120 }, () => ({
      x: r() * W, y: r() * H, a: r(), b: r(),
    }));
  }, [kind]);
  if (!items.length) return null;
  return (
    <svg className="sky fx" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {kind === 'rain'
        ? items.map((p, i) => {
            const len = 14 + p.a * 26;
            return (
              <line key={i} x1={p.x} y1={p.y} x2={p.x - len * 0.22} y2={p.y + len} stroke="#fff"
                strokeWidth={0.6 + p.b * 0.8} strokeLinecap="round" opacity={0.18 + p.a * 0.3} />
            );
          })
        : items.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={0.8 + p.a * 2.8} fill="#fff" opacity={0.45 + p.b * 0.5} />)}
    </svg>
  );
}
