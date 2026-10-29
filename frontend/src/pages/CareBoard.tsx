import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import GarmentArt from '../components/GarmentArt'
import { Loading, Notice, Sheet, Spinner, Toast } from '../components/Ui'
import { formatDate } from '../format'
import { useSession } from '../session'
import type { Board, BoardItem } from '../types'

type Tab = 'overdue' | 'dueToday' | 'inProgress' | 'history'
const TABS: { key: Tab; label: string }[] = [
  { key: 'overdue', label: '기한 지남' },
  { key: 'dueToday', label: '오늘 회수 예정' },
  { key: 'inProgress', label: '진행 중' },
  { key: 'history', label: '완료 이력' },
]

/** 관리함: 세탁·수선 맡긴 옷과 회수 예정일. 목록은 열 때마다 오늘 날짜로 다시 계산된다. */
export default function CareBoard() {
  const { refreshBadge } = useSession()
  const [board, setBoard] = useState<Board | null>(null)
  const [tab, setTab] = useState<Tab | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [editing, setEditing] = useState<BoardItem | null>(null)
  const [toast, setToast] = useState('')
  // 방금 회수한 옷: 목록에서는 빠지지만 다음 행동(보관 위치 확인)으로 바로 갈 수 있게 남긴다.
  const [returned, setReturned] = useState<BoardItem[]>([])

  const load = useCallback(() => {
    api.get<Board>('/api/care').then((b) => {
      setBoard(b)
      setTab((t) => t ?? (b.overdue.length ? 'overdue' : b.dueToday.length ? 'dueToday' : 'inProgress'))
    }).catch((e) => setError(errorMessage(e)))
  }, [])
  useEffect(load, [load])

  async function complete(item: BoardItem) {
    setBusy(item.care.id)
    setError('')
    try {
      setBoard(await api.post<Board>(`/api/care/${item.care.id}/complete`))
      refreshBadge()
      setReturned((r) => [item, ...r.filter((x) => x.garment.id !== item.garment.id)])
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (!board || !tab) return error ? <Notice>{error}</Notice> : <Loading />
  const items = board[tab]

  return (
    <>
      <div className="page-head"><h1 className="page-title">관리함</h1></div>
      <p className="page-lead">세탁소·수선집에 맡긴 옷과 돌려받을 날을 모아 봐요. 옮기기에서 세탁소로 묶어 보낸 옷도 여기에 모여요.</p>
      {error && <div style={{ marginBottom: 16 }}><Notice>{error}</Notice></div>}
      {returned.map((it) => (
        <div key={it.garment.id} style={{ marginBottom: 12 }}>
          <Notice kind="ok">
            회수 완료했어요. <Link to={`/closet/${it.garment.id}`} style={{ fontWeight: 700 }}>{it.garment.name}</Link>을(를) 눌러 보관 위치를 확인해 주세요.
          </Notice>
        </div>
      ))}

      <div className="tabs" role="tablist" aria-label="관리함 목록">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}{(t.key === 'overdue' || t.key === 'dueToday') && board[t.key].length > 0 && <span className="count">{board[t.key].length}</span>}
            {t.key === 'inProgress' && <span className="row-sub"> {board.inProgress.length}</span>}
          </button>
        ))}
      </div>

      <section role="tabpanel" aria-label={TABS.find((t) => t.key === tab)!.label}>
        {items.length === 0 && (
          <div className="empty">
            <strong>{tab === 'overdue' ? '기한이 지난 옷이 없어요' : tab === 'dueToday' ? '오늘 돌려받을 옷이 없어요' : tab === 'inProgress' ? '맡긴 옷이 없어요' : '아직 완료된 기록이 없어요'}</strong>
            {tab === 'inProgress' && <p>옷 정보에서 ‘세탁·수선 맡기기’를 누르면 여기에 모여요.</p>}
          </div>
        )}
        {items.map((it) => (
          <div className="row-item" key={it.care.id} aria-label={`${it.garment.name} ${it.care.careTypeLabel}`}>
            <div className="row-thumb">{it.garment.imageUrl ? <img src={it.garment.imageUrl} alt="" /> : <GarmentArt subType={it.garment.subType} colorHex={it.garment.colorHex} title={it.garment.name} />}</div>
            <div className="row-main">
              <Link className="row-title" to={`/closet/${it.garment.id}`}>{it.garment.name}</Link>
              {/* 진행 중이면 옷의 지금 상태(세탁 중·수선 중)를, 끝났으면 맡긴 종류를 앞에 둔다. */}
              <div className="row-sub">
                {it.care.completedAt ? it.care.careTypeLabel : <strong className="care-status">{it.garment.statusLabel}</strong>}
                , {it.care.place === 'SHOP' ? it.care.shopName ?? '업체' : '자택'}{it.care.description ? `, ${it.care.description}` : ''}
              </div>
              {it.care.completedAt ? (
                <div className="row-sub">{formatDate(it.care.droppedOn)} 맡김, {formatDate(it.care.completedAt)} 회수 완료</div>
              ) : (
                <div className={`row-sub${it.overdue ? ' danger' : ''}`}>
                  {it.care.dueOn ? `${formatDate(it.care.dueOn)} 회수 예정` : '회수 예정일 미정'}{it.overdue ? ', 기한 지남' : it.dueToday ? ', 오늘' : ''}
                </div>
              )}
            </div>
            {!it.care.completedAt && (
              <div className="row-actions">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(it)}>예정일 변경</button>
                <button type="button" className="btn btn-sm" onClick={() => complete(it)} disabled={busy !== null}>{busy === it.care.id && <Spinner />}회수 완료</button>
              </div>
            )}
          </div>
        ))}
      </section>

      {editing && <DueSheet item={editing} onClose={() => setEditing(null)} onSaved={(b) => { setBoard(b); setEditing(null); refreshBadge(); setToast('회수 예정일을 바꿨어요') }} />}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </>
  )
}

function DueSheet({ item, onClose, onSaved }: { item: BoardItem; onClose: () => void; onSaved: (b: Board) => void }) {
  const [dueOn, setDueOn] = useState(item.care.dueOn ?? '')
  const [careType, setCareType] = useState(item.care.careType)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    setError('')
    try {
      onSaved(await api.patch<Board>(`/api/care/${item.care.id}`, { dueOn: dueOn || null, careType }))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet title={`${item.garment.name} 기록 바꾸기`} onClose={onClose}>
      <div className="form-grid">
        <div className="field">
          <span className="field-label" id="due-type">종류</span>
          <div className="chips wrap" role="group" aria-labelledby="due-type" style={{ marginTop: 0 }}>
            <button type="button" className="chip" aria-pressed={careType === 'WASH'} onClick={() => setCareType('WASH')}>세탁</button>
            <button type="button" className="chip" aria-pressed={careType === 'REPAIR'} onClick={() => setCareType('REPAIR')}>수선</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="due-date">회수 예정일</label>
          <input id="due-date" className="input" type="date" value={dueOn} min={item.care.droppedOn} onChange={(e) => setDueOn(e.target.value)} />
        </div>
        {error && <Notice>{error}</Notice>}
      </div>
      <div className="sheet-actions">
        <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
        <button type="button" className="btn" onClick={save} disabled={busy}>{busy && <Spinner />}저장</button>
      </div>
    </Sheet>
  )
}
