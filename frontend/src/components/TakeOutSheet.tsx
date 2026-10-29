import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import type { GarmentSummary, MapView, SpaceView } from '../types'
import { Icon } from './Icon'
import { Loading, Notice, Sheet, Spinner } from './Ui'

/** 박스·집 밖과 그 아래 공간을 뺀, 옷을 바로 넣을 수 있는 집 안의 가장 안쪽 공간. */
function homeLeaves(spaces: SpaceView[]): SpaceView[] {
  const byId = new Map(spaces.map((s) => [s.id, s]))
  const away = (s: SpaceView | undefined): boolean => {
    for (let cur = s, depth = 0; cur && depth < 10; cur = cur.parentId ? byId.get(cur.parentId) : undefined, depth++) {
      if (cur.spaceType === 'BOX' || cur.spaceType === 'OFFSITE') return true
    }
    return false
  }
  return spaces.filter((s) => !spaces.some((o) => o.parentId === s.id) && !away(s))
}

type Entry = { root: SpaceView; leaves: SpaceView[] }

/** 고를 공간을 맨 위 공간(옷장 A, 서랍장…)별로 묶는다. 맨 위 공간 자체가 고를 칸이면 묶지 않고 한 줄로 둔다. */
function groupByRoot(all: SpaceView[], options: SpaceView[]): Entry[] {
  const byId = new Map(all.map((s) => [s.id, s]))
  const rootOf = (s: SpaceView) => {
    let cur = s
    for (let depth = 0; cur.parentId && byId.has(cur.parentId) && depth < 10; depth++) cur = byId.get(cur.parentId)!
    return cur
  }
  // 처음 나온 순서대로 묶는다(Map은 넣은 순서를 지킨다).
  const entries = new Map<number, Entry>()
  for (const leaf of options) {
    const root = rootOf(leaf)
    const entry = entries.get(root.id)
    if (entry) entry.leaves.push(leaf)
    else entries.set(root.id, { root, leaves: [leaf] })
  }
  return [...entries.values()]
}

/**
 * 공간 고르기 목록(디자인 초안 LocationSheet의 .loc-list). 맨 위 공간 이름 아래에 칸을 들여 쓴다.
 * 줄마다 접근성 이름은 전체 경로(예: '옷장 A → 왼쪽 행거, 걸기, 3/10벌')로 둔다.
 */
export function SpaceList({ all, options, pick, current, label, onPick }: {
  all: SpaceView[]; options: SpaceView[]; pick: number | null; current?: number | null; label: string; onPick: (id: number) => void
}) {
  const row = (s: SpaceView, text: string, indent: boolean) => {
    const meta = `${s.spaceTypeLabel}${s.capacity ? `, ${s.count}/${s.capacity}벌` : `, ${s.count}벌`}`
    const on = pick === s.id
    return (
      <button key={s.id} type="button" className={`loc-row${indent ? ' indent' : ''}`} data-on={on} aria-pressed={on}
        aria-label={`${s.path}, ${meta}${s.id === current ? ', 지금 위치' : ''}`} onClick={() => onPick(s.id)}>
        <span className="radio">{on && <Icon name="check" size={13} stroke={3} />}</span>
        <span className="loc-row-main">{text}<small>{meta}</small></span>
        {s.id === current && <em>지금 위치</em>}
      </button>
    )
  }
  return (
    <div className="loc-list" role="radiogroup" aria-label={label}>
      {groupByRoot(all, options).map(({ root, leaves }) =>
        leaves.length === 1 && leaves[0].id === root.id ? (
          row(root, root.name, false)
        ) : (
          <div key={root.id} className="loc-group">
            <p className="loc-space"><Icon name="box" size={15} />{root.name}</p>
            {leaves.map((s) => row(s, s.path.startsWith(`${root.path} → `) ? s.path.slice(root.path.length + 3) : s.name, true))}
          </div>
        ),
      )}
    </div>
  )
}

/**
 * 꺼내기(원인 (나)): 박스·본가에 있던 옷을 찾은 그 카드에서, 옷 상세를 열지 않고 집 안 자리를 한 번 고른다.
 * 누르는 즉시 그 공간이 확정 위치가 된다.
 */
export default function TakeOutSheet({ garment, onClose, onDone }: { garment: GarmentSummary; onClose: () => void; onDone: () => void }) {
  const [map, setMap] = useState<MapView | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get<MapView>('/api/spaces').then(setMap).catch((e) => setError(errorMessage(e)))
  }, [])
  const spaces = map ? homeLeaves(map.spaces) : null

  async function save() {
    if (!pick) return
    setBusy(true)
    setError('')
    try {
      await api.post(`/api/spaces/${pick}/garments`, { garmentIds: [garment.id] })
      onDone()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Sheet title={`${garment.name} 꺼내기`} onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary btn-block" disabled={!pick || busy} onClick={save}>
          {busy && <Spinner />}여기에 둠
        </button>
      }>
      <p className="sheet-text sheet-lead">
        지금 {garment.locationKindLabel} · {garment.locationPath}에 있어요. 꺼내서 둘 집 안 자리를 고르면 바로 그 위치로 바뀌어요.
      </p>
      {error && <Notice>{error}</Notice>}
      {!map && !error && <Loading />}
      {spaces && spaces.length === 0 && (
        <div className="empty sheet-empty">
          <p>집 안에 넣을 공간이 아직 없어요. 옷장 지도에서 옷장이나 서랍을 먼저 만들어 주세요.</p>
          <Link className="btn btn-primary" to="/map">옷장 지도</Link>
        </div>
      )}
      {map && spaces && spaces.length > 0 && (
        <SpaceList all={map.spaces} options={spaces} pick={pick} label="꺼내서 둘 곳" onPick={setPick} />
      )}
    </Sheet>
  )
}
