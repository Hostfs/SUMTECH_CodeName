import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession } from '../session'
import type { GarmentSummary, SpaceView } from '../types'
import GarmentArt from './GarmentArt'
import { Icon, type IconName } from './Icon'
import '../styles/storage.app.css'

const TABS = [
  { to: '/map', label: '옷장 지도' },
  { to: '/care', label: '관리함' },
  { to: '/move', label: '옮기기' },
]

/**
 * 보관함 머리(디자인 초안 Storage의 고정 영역 .pin): 제목 줄과 옷장 지도·관리함·옮기기 보기 전환(.seg).
 * 초안은 한 화면 안의 탭이지만 우리는 주소가 바뀌는 링크라 nav로 둔다.
 * action은 제목 줄 오른쪽(초안의 '공간 추가'), children은 함께 고정할 조작부(관리함 목록 탭 등).
 */
export default function StorageTabs({ action, children }: { action?: ReactNode; children?: ReactNode }) {
  const { pathname } = useLocation()
  const { careBadge } = useSession()
  return (
    <div className="pin">
      <header className="page-head page-title-row">
        <h1>보관함</h1>
        {action}
      </header>
      <nav className="seg st-seg" aria-label="보관함 보기">
        {TABS.map((t) => {
          const on = pathname === t.to
          return (
            <Link key={t.to} to={t.to} data-on={on} aria-current={on ? 'page' : undefined}>
              {t.label}
              {t.to === '/care' && careBadge > 0 && <b className="seg-dot" aria-label={`처리할 관리 ${careBadge}건`}>{careBadge}</b>}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}

type Pictured = Pick<GarmentSummary, 'imageUrl' | 'subType' | 'colorHex'>

/** 옷 사진이 있으면 사진, 없으면 일러스트(초안 GarmentImage). 크기는 감싼 칸(.thumb·.care-art·.mini-tile…)이 정한다. */
export function GarmentThumb({ g }: { g: Pictured }) {
  return (
    <span className="st-art" aria-hidden="true">
      {g.imageUrl ? <img src={g.imageUrl} alt="" draggable={false} /> : <GarmentArt subType={g.subType} colorHex={g.colorHex} />}
    </span>
  )
}

/** 겹쳐 놓은 작은 옷 썸네일(초안 Thumbs). 넘치는 벌 수는 +N. */
export function Thumbs({ items, max = 5 }: { items: (Pictured & { id: number; name: string })[]; max?: number }) {
  if (!items.length) return <span className="thumbs-empty">비어 있어요</span>
  return (
    <span className="thumbs">
      {items.slice(0, max).map((g) => (
        <span key={g.id} className="thumb" title={g.name}><GarmentThumb g={g} /></span>
      ))}
      {items.length > max && <span className="thumb more">+{items.length - max}</span>}
    </span>
  )
}

/** 옷 한 벌을 골랐다 풀었다 하는 줄(옮기기·옷 넣기). 초안 .row-link 모양에 .gcheck 같은 동그라미 체크. */
export function GarmentPick({ g, on, sub, onToggle }: {
  g: Pictured & { name: string }; on: boolean; sub: ReactNode; onToggle: () => void
}) {
  return (
    <button type="button" className="row-link st-pick" aria-pressed={on} onClick={onToggle}>
      <span className="st-check" aria-hidden="true"><Icon name="check" size={14} stroke={3} /></span>
      <span className="mini-tile"><GarmentThumb g={g} /></span>
      <span className="row-main"><b>{g.name}</b><small>{sub}</small></span>
    </button>
  )
}

/** 공간 종류별 아이콘(초안 KIND_ICON: 걸기는 옷걸이, 나머지는 상자). 집 밖(본가 등)은 집. */
function iconOf(spaceType: string): IconName {
  if (spaceType === 'HANG') return 'hanger'
  if (spaceType === 'OFFSITE') return 'home'
  return 'box'
}

export function SpaceIcon({ type, size = 19 }: { type: string; size?: number }) {
  return <Icon name={iconOf(type)} size={size} />
}

/**
 * 공간 고르기(초안 LocationSheet의 .loc-list + .loc-row·.radio). 맨 위 공간별로 묶고 안쪽 공간은 들여 쓴다.
 * 줄의 접근성 이름은 전체 경로로 시작한다(예: '여름 박스, 박스, 3/12벌'). children은 목록 끝에 붙는 줄(새로 만들기 등).
 */
export function PlaceRadios({ all, options, checked, onPick, note, danger, label, labelledBy, children }: {
  all: SpaceView[]; options: SpaceView[]; checked: number | null; onPick: (s: SpaceView) => void
  /** 줄 오른쪽 작은 글씨(종류·벌 수) */
  note: (s: SpaceView) => string
  /** 넘침처럼 붉게 보일 줄 */
  danger?: (s: SpaceView) => boolean
  label?: string; labelledBy?: string; children?: ReactNode
}) {
  const byId = new Map(all.map((s) => [s.id, s]))
  const rootOf = (s: SpaceView) => {
    let cur = s
    for (let depth = 0; cur.parentId && byId.has(cur.parentId) && depth < 10; depth++) cur = byId.get(cur.parentId)!
    return cur
  }
  // 처음 나온 순서대로 맨 위 공간별로 묶는다.
  const groups = new Map<number, { root: SpaceView; leaves: SpaceView[] }>()
  for (const leaf of options) {
    const root = rootOf(leaf)
    const g = groups.get(root.id)
    if (g) g.leaves.push(leaf)
    else groups.set(root.id, { root, leaves: [leaf] })
  }
  const row = (s: SpaceView, text: string, indent: boolean) => {
    const on = checked === s.id
    const meta = note(s)
    return (
      <button key={s.id} type="button" role="radio" aria-checked={on} data-on={on} aria-label={`${s.path}, ${meta}`}
        className={`loc-row${indent ? ' indent' : ''}`} onClick={() => onPick(s)}>
        <span className="radio">{on && <Icon name="check" size={13} stroke={3} />}</span>
        <span className="st-loc-name">{text}</span>
        <em className={danger?.(s) ? 'st-danger' : undefined}>{meta}</em>
      </button>
    )
  }
  return (
    <div className="loc-list" role="radiogroup" aria-label={label} aria-labelledby={labelledBy}>
      {[...groups.values()].map(({ root, leaves }) =>
        leaves.length === 1 && leaves[0].id === root.id ? row(root, root.name, false) : (
          <div key={root.id} className="loc-group">
            <p className="loc-space"><SpaceIcon type={root.spaceType} size={15} />{root.name}</p>
            {leaves.map((s) => row(s, s.path.startsWith(`${root.path} → `) ? s.path.slice(root.path.length + 3) : s.name, true))}
          </div>
        ),
      )}
      {children}
    </div>
  )
}
