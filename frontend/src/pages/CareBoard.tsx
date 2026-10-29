import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { downloadCareIcs } from '../calendar'
import { Icon } from '../components/Icon'
import StorageTabs, { GarmentThumb } from '../components/StorageTabs'
import { Loading, Notice, Sheet, Spinner, Toast } from '../components/Ui'
import { formatDate } from '../format'
import { useSession } from '../session'
import type { Board, BoardItem } from '../types'
import '../styles/storage.app.css'

type Tab = 'overdue' | 'dueToday' | 'inProgress' | 'history'
const TABS: { key: Tab; label: string }[] = [
  { key: 'overdue', label: '기한 지남' },
  { key: 'dueToday', label: '오늘 회수 예정' },
  { key: 'inProgress', label: '진행 중' },
  { key: 'history', label: '완료 이력' },
]

/** 초안 dueLabel처럼 회수 예정일까지 남은 날을 짧게(서버의 오늘 기준): '2일 지남' · '오늘' · '내일' · '3일 뒤'. */
function dueWord(today: string, due: string) {
  const d = Math.round((new Date(`${due}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000)
  return d < 0 ? `${-d}일 지남` : d === 0 ? '오늘' : d === 1 ? '내일' : `${d}일 뒤`
}

const whereOf = (it: BoardItem) => (it.care.place === 'SHOP' ? it.care.shopName ?? '업체' : '자택')

/**
 * 관리함(디자인 초안 보관함의 '관리함'): 세탁·수선 맡긴 옷과 회수 예정일. 목록은 열 때마다 오늘 날짜로 다시 계산된다.
 * 초안은 기한 지남·오늘·진행 중·완료 이력을 한 줄로 이어 보이지만, 우리는 같은 부품(.care-item·.history)을 목록 탭(.chips)으로 나눠 담는다.
 */
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
  const closeEdit = useCallback(() => setEditing(null), [])
  const clearToast = useCallback(() => setToast(''), [])

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

  if (!board || !tab) {
    return (
      <div className="page pinned storage">
        <StorageTabs />
        {error ? <Notice>{error}</Notice> : <Loading />}
      </div>
    )
  }
  const items = board[tab]
  const label = TABS.find((t) => t.key === tab)!.label

  const careRow = (it: BoardItem) => (
    <li key={it.care.id} className={`care-item ${it.overdue ? 'late' : it.dueToday ? 'today' : 'go'}`} aria-label={`${it.garment.name} ${it.care.careTypeLabel}`}>
      <Link to={`/closet/${it.garment.id}`} className="care-top">
        <span className="care-art"><GarmentThumb g={it.garment} /></span>
        <span className="care-main">
          <b>{it.garment.name}</b>
          {/* 옷의 지금 상태(세탁 중·수선 중)를 앞에 두고 맡긴 곳을 잇는다. */}
          <small>{it.garment.statusLabel} · {whereOf(it)}{it.care.description ? ` · ${it.care.description}` : ''}</small>
          <small className="st-care-date">{it.care.dueOn ? `${formatDate(it.care.dueOn)} 회수 예정` : '회수 예정일 미정'}</small>
        </span>
        {it.care.dueOn && <span className="care-due">{dueWord(board.today, it.care.dueOn)}</span>}
      </Link>
      <div className="care-actions">
        <button type="button" className="btn btn-sm" onClick={() => complete(it)} disabled={busy !== null}>{busy === it.care.id && <Spinner />}회수 완료</button>
        <span className="st-care-more">
          {/* 앱을 열지 않는 날을 위해 회수 예정일을 휴대폰 달력으로 넘긴다(지난 날짜는 넘기지 않는다). */}
          {it.care.dueOn && !it.overdue && (
            <button type="button" className="btn-text" onClick={() => { downloadCareIcs(it); setToast('달력 파일을 받았어요. 열면 달력에 추가돼요') }}>달력에 넣기</button>
          )}
          <button type="button" className="btn-text" onClick={() => setEditing(it)}>예정일 변경</button>
        </span>
      </div>
    </li>
  )

  return (
    <div className="page pinned storage">
      <StorageTabs>
        <div className="chips scroll st-tabs" role="tablist" aria-label="관리함 목록">
          {TABS.map((t) => {
            const on = tab === t.key
            const n = board[t.key].length
            return (
              <button key={t.key} type="button" role="tab" className="chip" data-on={on} aria-selected={on} onClick={() => setTab(t.key)}>
                {t.label}
                {(t.key === 'overdue' || t.key === 'dueToday') && n > 0 && <b className="seg-dot">{n}</b>}
                {t.key === 'inProgress' && <small>{n}</small>}
              </button>
            )
          })}
        </div>
      </StorageTabs>

      {error && <Notice>{error}</Notice>}
      {returned.map((it) => (
        <div key={it.garment.id} className="st-returned">
          <Notice kind="ok">
            회수 완료했어요. <Link to={`/closet/${it.garment.id}`}>{it.garment.name}</Link>을(를) 눌러 보관 위치를 확인해 주세요.
          </Notice>
        </div>
      ))}

      <section className="st-panel" role="tabpanel" aria-label={label}>
        <h2 className={`section-title${tab === 'overdue' && items.length > 0 ? ' danger' : ''}`}>
          {label}{tab !== 'history' && <> <small>{items.length}</small></>}
        </h2>
        {items.length === 0 ? (
          <div className="empty">
            <p className="empty-title">{tab === 'overdue' ? '기한이 지난 옷이 없어요' : tab === 'dueToday' ? '오늘 돌려받을 옷이 없어요' : tab === 'inProgress' ? '맡긴 옷이 없어요' : '아직 완료된 기록이 없어요'}</p>
            {tab === 'inProgress' && <p>옷 정보에서 ‘세탁·수선 맡기기’를 누르거나 옮기기에서 세탁소로 묶어 보내면 여기에 모여요.</p>}
          </div>
        ) : tab === 'history' ? (
          <ul className="history st-history-grid">
            {items.map((it) => (
              <li key={it.care.id} aria-label={`${it.garment.name} ${it.care.careTypeLabel}`}>
                <Icon name="check" size={15} stroke={2.4} />
                <span>
                  <Link to={`/closet/${it.garment.id}`}><b>{it.garment.name}</b></Link> {it.care.careTypeLabel} 회수 · {whereOf(it)}
                  <em className="st-history-sub">{formatDate(it.care.droppedOn)} 맡김{it.care.description ? ` · ${it.care.description}` : ''}</em>
                </span>
                <small>{formatDate(it.care.completedAt)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="care-list st-care-grid">{items.map(careRow)}</ul>
        )}
      </section>

      {editing && (
        <DueSheet item={editing} onClose={closeEdit}
          onSaved={(b) => { setBoard(b); setEditing(null); refreshBadge(); setToast('회수 예정일을 바꿨어요') }} />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}

/** 회수 예정일 변경(초안 시트): 종류(세탁·수선)와 회수 예정일. 예정일은 맡긴 날보다 앞설 수 없다. */
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
    <Sheet title="회수 예정일 변경" onClose={onClose}
      footer={<button type="button" className="btn btn-primary btn-block" onClick={save} disabled={busy}>{busy && <Spinner />}변경</button>}>
      <div className="fields">
        <p className="hint">{item.garment.name} · {item.care.careTypeLabel} · {whereOf(item)}, {formatDate(item.care.droppedOn)} 맡김</p>
        <div className="field">
          <span id="st-due-type">종류</span>
          <div className="chips" role="group" aria-labelledby="st-due-type">
            <button type="button" className="chip" data-on={careType === 'WASH'} aria-pressed={careType === 'WASH'} onClick={() => setCareType('WASH')}>세탁</button>
            <button type="button" className="chip" data-on={careType === 'REPAIR'} aria-pressed={careType === 'REPAIR'} onClick={() => setCareType('REPAIR')}>수선</button>
          </div>
        </div>
        <label className="field"><span>회수 예정일</span>
          <input type="date" value={dueOn} min={item.care.droppedOn} onChange={(e) => { setDueOn(e.target.value); setError('') }} aria-invalid={!!error} />
          {error && <small className="field-error">{error}</small>}
        </label>
      </div>
    </Sheet>
  )
}
