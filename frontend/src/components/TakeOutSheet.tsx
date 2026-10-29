import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import type { GarmentSummary, MapView, SpaceView } from '../types'
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

/**
 * 꺼내기(원인 (나)): 박스·본가에 있던 옷을 찾은 그 카드에서, 옷 상세를 열지 않고 집 안 자리를 한 번 고른다.
 * 누르는 즉시 그 공간이 확정 위치가 된다.
 */
export default function TakeOutSheet({ garment, onClose, onDone }: { garment: GarmentSummary; onClose: () => void; onDone: () => void }) {
  const [spaces, setSpaces] = useState<SpaceView[] | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get<MapView>('/api/spaces').then((m) => setSpaces(homeLeaves(m.spaces))).catch((e) => setError(errorMessage(e)))
  }, [])

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
    <Sheet title={`${garment.name} 꺼내기`} onClose={onClose}>
      <p className="field-hint" style={{ marginTop: 0 }}>
        지금 {garment.locationKindLabel} · {garment.locationPath}에 있어요. 꺼내서 둘 집 안 자리를 고르면 바로 그 위치로 바뀌어요.
      </p>
      {error && <Notice>{error}</Notice>}
      {!spaces && !error && <Loading />}
      {spaces && spaces.length === 0 && (
        <div className="empty"><p>집 안에 넣을 공간이 아직 없어요. 옷장 지도에서 옷장이나 서랍을 먼저 만들어 주세요.</p><Link className="btn" to="/map">옷장 지도</Link></div>
      )}
      {spaces && spaces.length > 0 && (
        <div className="form-grid" role="radiogroup" aria-label="꺼내서 둘 곳">
          {spaces.map((s) => (
            <button key={s.id} type="button" className="cand" style={{ gridTemplateColumns: '1fr auto' }} aria-pressed={pick === s.id} onClick={() => setPick(s.id)}>
              <span><span className="cand-name">{s.path}</span><br /><span className="cand-meta">{s.spaceTypeLabel}{s.capacity ? `, ${s.count}/${s.capacity}벌` : `, ${s.count}벌`}</span></span>
            </button>
          ))}
        </div>
      )}
      <div className="sheet-actions">
        <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
        <button type="button" className="btn" disabled={!pick || busy} onClick={save}>{busy && <Spinner />}여기에 둠</button>
      </div>
    </Sheet>
  )
}
