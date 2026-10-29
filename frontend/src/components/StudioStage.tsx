import type { GarmentSummary } from '../types'
import { SLOT_LABEL, type Picks, type Slot } from '../lib/outfit'
import GarmentArt from './GarmentArt'

// 2D 앞모습 마네킹 무대. 고른 옷을 하의 → 원피스 → 상의 → 아우터 순서로 겹쳐 그린다.
// 사진이 있으면 대표 사진을, 없으면 옷 종류·색으로 그린 일러스트를 쓴다(몸 치수·사진 맞춤은 하지 않는다).

const LAYERS: Slot[] = ['BOTTOM', 'DRESS', 'TOP', 'OUTER']

function Mannequin() {
  const skin = 'url(#studio-skin)'
  const edge = 'rgb(120 108 92 / .32)'
  return (
    <svg className="studio-figure" viewBox="0 0 200 440" aria-hidden="true">
      <defs>
        <linearGradient id="studio-skin" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9d3c8" />
          <stop offset=".32" stopColor="#f2eee6" />
          <stop offset=".68" stopColor="#f6f2eb" />
          <stop offset="1" stopColor="#d5cfc3" />
        </linearGradient>
        <radialGradient id="studio-floor" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#e8e4db" />
          <stop offset="1" stopColor="#d6d1c5" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="424" rx="74" ry="12" fill="url(#studio-floor)" />
      <ellipse cx="100" cy="422" rx="52" ry="6" fill="rgb(60 50 40 / .1)" />
      {/* 다리 */}
      <path d="M78 218 C74 270 76 330 80 410 L92 410 C94 340 97 280 100 238 C103 280 106 340 108 410 L120 410 C124 330 126 270 122 218 Z" fill={skin} stroke={edge} />
      <ellipse cx="84" cy="414" rx="13" ry="5" fill={skin} stroke={edge} />
      <ellipse cx="116" cy="414" rx="13" ry="5" fill={skin} stroke={edge} />
      {/* 팔 */}
      <path d="M58 86 C48 120 44 160 40 206 C40 214 50 216 52 208 C58 166 64 128 70 100 Z" fill={skin} stroke={edge} />
      <path d="M142 86 C152 120 156 160 160 206 C160 214 150 216 148 208 C142 166 136 128 130 100 Z" fill={skin} stroke={edge} />
      {/* 몸통 */}
      <path d="M90 66 L110 66 L114 76 C130 78 142 82 144 92 C142 118 136 140 132 160 C132 180 136 200 126 226 L74 226 C64 200 68 180 68 160 C64 140 58 118 56 92 C58 82 70 78 86 76 Z" fill={skin} stroke={edge} />
      {/* 머리 */}
      <path d="M100 14 C114 14 122 24 122 38 C122 52 112 64 100 64 C88 64 78 52 78 38 C78 24 86 14 100 14 Z" fill={skin} stroke={edge} />
    </svg>
  )
}

function Piece({ slot, g }: { slot: Slot; g: GarmentSummary }) {
  return (
    <div className={`studio-layer studio-${slot.toLowerCase()}`} data-testid={`studio-${slot}`}>
      {g.imageUrl
        ? <img src={g.imageUrl} alt={`${SLOT_LABEL[slot]} ${g.name}`} />
        : <GarmentArt subType={g.subType} colorHex={g.colorHex} title={`${SLOT_LABEL[slot]} ${g.name}`} />}
    </div>
  )
}

export default function StudioStage({ picks }: { picks: Picks }) {
  const chosen = LAYERS.filter((s) => picks[s])
  return (
    <div className="studio-stage" aria-label={chosen.length ? `마네킹: ${chosen.map((s) => picks[s]!.name).join(', ')}` : '빈 마네킹'} role="img">
      <div className="studio-frame">
        <Mannequin />
        {chosen.map((s) => <Piece key={`${s}-${picks[s]!.id}`} slot={s} g={picks[s]!} />)}
      </div>
      {chosen.length === 0 && <p className="studio-hint">아래에서 옷을 고르면 입혀 봐요</p>}
    </div>
  )
}
