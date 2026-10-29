import { useRef } from 'react';
import type { PhotoKind, Points, Pt } from '../lib/cutout';

// 누끼 딴 옷 위에 기준점(목·어깨·소매 끝·밑단)을 얹어, 끌어서 바로잡는 화면.
// 자동으로 찍은 위치가 틀려도 여기서 고치면 마네킹에 입힐 때 그대로 쓰인다.
const LABELS: Record<string, string> = {
  neck: '목', lShoulder: '왼어깨', rShoulder: '오른어깨', lCuff: '왼소매끝', rCuff: '오른소매끝',
  lWaist: '왼허리', rWaist: '오른허리', hem: '밑단',
};
const ORDER: Record<PhotoKind, string[]> = {
  top: ['neck', 'lShoulder', 'rShoulder', 'lCuff', 'rCuff', 'hem'],
  outer: ['neck', 'lShoulder', 'rShoulder', 'lCuff', 'rCuff', 'hem'],
  bottom: ['lWaist', 'rWaist', 'hem'],
  shoes: [],
};

interface Props {
  src: string;
  w: number;
  h: number;
  kind: PhotoKind;
  points: Points;
  onChange: (p: Points) => void;
}

export function FitEditor({ src, w, h, kind, points, onChange }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<string | null>(null);
  const keys = ORDER[kind].filter((k) => points[k]);
  const r = Math.max(9, w * 0.026);

  const at = (e: React.PointerEvent): Pt => {
    const box = svg.current!.getBoundingClientRect();
    return [Math.min(w, Math.max(0, ((e.clientX - box.left) / box.width) * w)), Math.min(h, Math.max(0, ((e.clientY - box.top) / box.height) * h))];
  };

  return (
    <div className="fit-editor" style={{ aspectRatio: `${w} / ${h}`, ['--ar' as string]: w / h }}>
      <img src={src} alt="누끼 딴 옷" draggable={false} />
      <svg
        ref={svg}
        viewBox={`0 0 ${w} ${h}`}
        onPointerMove={(e) => {
          if (!drag.current) return;
          onChange({ ...points, [drag.current]: at(e) });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {/* 어깨선·허리선을 이어 보여 준다 */}
        {kind !== 'bottom' && kind !== 'shoes' && points.lShoulder && points.rShoulder && (
          <polyline points={[points.lShoulder, points.neck, points.rShoulder].filter(Boolean).map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={r * 0.28} strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
        )}
        {kind === 'bottom' && points.lWaist && points.rWaist && (
          <line x1={points.lWaist[0]} y1={points.lWaist[1]} x2={points.rWaist[0]} y2={points.rWaist[1]} stroke="var(--accent)" strokeWidth={r * 0.28} strokeLinecap="round" />
        )}
        {keys.map((k) => (
          <g
            key={k}
            transform={`translate(${points[k][0]} ${points[k][1]})`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = k;
            }}
            style={{ cursor: 'grab', touchAction: 'none' }}
          >
            <circle r={r * 1.9} fill="transparent" />
            <circle r={r} fill="var(--accent)" stroke="#fff" strokeWidth={r * 0.28} />
            <text y={-r * 1.5} textAnchor="middle" fontSize={r * 1.25} fontWeight="700" fill="#1c1b1a" stroke="#fff" strokeWidth={r * 0.35} paintOrder="stroke" style={{ pointerEvents: 'none' }}>
              {LABELS[k]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
