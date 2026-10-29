import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { Icon } from '../components/Icon'
import StorageTabs, { GarmentPick, PlaceRadios } from '../components/StorageTabs'
import { Loading, Notice, Sheet, Spinner, Toast } from '../components/Ui'
import { formatDate } from '../format'
import { processCoverIfNeeded } from '../imageCleanup'
import { useSession } from '../session'
import type { GarmentDetail, GarmentSummary, MapView, MoveBatch, SpaceView } from '../types'
import '../styles/storage.app.css'

type Dest = 'SPACE' | 'LAUNDRY'
type NewPlace = { name: string; spaceType: 'BOX' | 'OFFSITE' }

/** 회수 예정일 빠른 고르기 */
const QUICK: [string, number][] = [['내일', 1], ['3일 뒤', 3], ['1주 뒤', 7]]

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(base: string, days: number) {
  const d = new Date(`${base}T00:00:00`)
  d.setDate(d.getDate() + days)
  return iso(d)
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000)
}
/** 받침에 따라 '로'/'으로'(ㄹ 받침은 '로'). */
function ro(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return `${word}(으)로`
  const jong = code % 28
  return `${word}${jong === 0 || jong === 8 ? '로' : '으로'}`
}

/** 보낼 곳: 박스·집 밖 공간과 그 아래 가장 안쪽 공간('본가 → 안방 옷장'). 옷은 가장 안쪽 공간에만 넣는다. */
function boxPlaces(map: MapView): SpaceView[] {
  const byId = new Map(map.spaces.map((s) => [s.id, s]))
  const away = (s: SpaceView | undefined): boolean => {
    for (let cur = s, depth = 0; cur && depth < 10; cur = cur.parentId ? byId.get(cur.parentId) : undefined, depth++) {
      if (cur.spaceType === 'BOX' || cur.spaceType === 'OFFSITE') return true
    }
    return false
  }
  return map.spaces.filter((s) => away(s) && !map.spaces.some((o) => o.parentId === s.id))
}

/**
 * 옮기기(F10): 박스·집 밖·세탁소로 여러 벌을 한 번에 옮긴다. 옮기는 순간을 짧게 끝내도록
 * 보낼 곳·업체·날짜는 가장 최근 기록으로 미리 채우고, 옷만 체크하면 된다.
 * 초안에 없는 화면이라 초안 부품으로 짓는다: 보낼 곳은 .chips 탭 + .loc-row·.radio 목록(LocationSheet),
 * 옮길 옷은 .row-link 줄 + 체크, 보내기 버튼은 휴대폰에서 하단 탭 위에 떠 있다. PC는 보낼 곳(왼쪽)·옮길 옷(오른쪽).
 */
export default function Move() {
  const { meta, refreshBadge } = useSession()
  const [params] = useSearchParams()
  const today = iso(new Date())
  const [map, setMap] = useState<MapView | null>(null)
  const [garments, setGarments] = useState<GarmentSummary[] | null>(null)
  const [recent, setRecent] = useState<MoveBatch[] | null>(null)
  const [error, setError] = useState('')

  const [dest, setDest] = useState<Dest>('SPACE')
  const [spaceId, setSpaceId] = useState<number | null>(null)
  const [newPlace, setNewPlace] = useState<NewPlace | null>(null)
  const [shopName, setShopName] = useState('')
  const [movedOn, setMovedOn] = useState(today)
  const [dueOn, setDueOn] = useState(addDays(today, 3))
  const [picked, setPicked] = useState<number[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<MoveBatch | null>(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState('')
  const defaulted = useRef(false)
  const closeAdd = useCallback(() => setAdding(false), [])
  const clearToast = useCallback(() => setToast(''), [])

  // 처음 열 때 한 번: 가장 최근 묶음의 보낸 곳·업체·회수 간격을 기본값으로 채운다.
  useEffect(() => {
    if (defaulted.current) return
    defaulted.current = true
    const all = api.get<GarmentSummary[]>('/api/garments')
    all.then(setGarments).catch((e) => setError(errorMessage(e)))
    Promise.all([api.get<MapView>('/api/spaces'), api.get<MoveBatch[]>('/api/moves').catch(() => [] as MoveBatch[]), all.catch(() => [] as GarmentSummary[])])
      .then(([m, r, list]) => {
        const leaves = boxPlaces(m)
        const lastSpace = r.find((b) => b.destination === 'SPACE' && leaves.some((p) => p.id === b.spaceId))
        const lastLaundry = r.find((b) => b.destination === 'LAUNDRY')
        const d: Dest = r[0]?.destination ?? 'SPACE'
        const sid = lastSpace?.spaceId ?? leaves[0]?.id ?? null
        setDest(d)
        setSpaceId(sid)
        if (lastLaundry?.shopName) setShopName(lastLaundry.shopName)
        if (lastLaundry?.movedOn && lastLaundry.dueOn) setDueOn(addDays(today, Math.max(0, daysBetween(lastLaundry.movedOn, lastLaundry.dueOn))))
        // 내 옷장 '선택'에서 넘어왔으면(?ids=1,2) 그 옷을 미리 체크한다. 목록에 보이는 옷만 담는다.
        const wanted = (params.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0)
        if (wanted.length > 0) {
          const pre = wanted.filter((id) => list.some((g) => g.id === id && g.locationKind !== 'CARE' && !(d === 'SPACE' && g.spaceId === sid && g.locationPath)))
          setPicked(pre)
          if (pre.length > 0) setToast(pre.length === wanted.length ? `고른 ${pre.length}벌을 담았어요` : `고른 ${wanted.length}벌 중 ${pre.length}벌을 담았어요`)
        }
        setMap(m)
        setRecent(r)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [params, today])

  const places = useMemo(() => (map ? boxPlaces(map) : []), [map])

  const target: SpaceView | undefined = map?.spaces.find((s) => s.id === spaceId)
  const choices = (garments ?? [])
    .filter((g) => g.locationKind !== 'CARE')
    .filter((g) => !(dest === 'SPACE' && target && g.spaceId === target.id && g.locationPath))
    .filter((g) => !query.trim() || [g.name, g.colorName, g.locationPath].some((v) => v?.includes(query.trim())))
  const destName = dest === 'LAUNDRY' ? (shopName.trim() || '세탁소') : newPlace ? newPlace.name.trim() : target?.name ?? ''
  // 새로 만들기를 골랐으면 이름이 있어야 보낼 수 있다(버튼 글자 '보낼 곳을 골라 주세요'와 같은 기준).
  const ready = picked.length > 0 && (dest === 'LAUNDRY' ? Boolean(dueOn) : newPlace ? Boolean(newPlace.name.trim()) : Boolean(target))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const batch = await api.post<MoveBatch>('/api/moves', dest === 'SPACE'
        ? { destination: 'SPACE', spaceId: newPlace ? null : spaceId, newSpace: newPlace, movedOn, garmentIds: picked }
        : { destination: 'LAUNDRY', shopName, movedOn, dueOn, garmentIds: picked })
      setDone(batch)
      setRecent((r) => [batch, ...(r ?? [])])
      setPicked([])
      if (newPlace) {
        setNewPlace(null)
        setSpaceId(batch.spaceId)
      }
      // 보낼 곳 줄에 벌 수를 보여 주므로 옮길 때마다 공간을 다시 읽는다(새로 만든 곳도 여기서 목록에 들어온다).
      api.get<MapView>('/api/spaces').then(setMap).catch(() => undefined)
      api.get<GarmentSummary[]>('/api/garments').then(setGarments).catch(() => undefined)
      if (dest === 'LAUNDRY') refreshBadge()
      setToast(dest === 'LAUNDRY' ? `${batch.garments.length}벌을 맡겼어요` : `${batch.garments.length}벌을 옮겼어요`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!map || !garments || !recent) {
    return (
      <div className="page pinned storage">
        <StorageTabs />
        {error ? <Notice>{error}</Notice> : <Loading />}
      </div>
    )
  }

  const toggle = (id: number) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])

  return (
    <div className="page pinned storage st-move">
      <StorageTabs />
      <p className="hint st-lead">박스에 넣거나 본가·세탁소로 보낼 때, 옷을 한 벌씩이 아니라 묶음으로 한 번에 기록해요. 보낼 곳과 날짜는 미리 채워 두었어요.</p>

      {done && (
        <div className="loc-card st-done" role="status" aria-label="옮긴 결과">
          <span className="loc-icon"><Icon name="check" size={22} stroke={2.4} /></span>
          <div className="st-done-main">
            <b>{done.destination === 'LAUNDRY' ? `${done.shopName ?? '세탁소'}에 ${done.garments.length}벌 맡김` : `${ro(done.spacePath ?? '')} ${done.garments.length}벌 보냄`}</b>
            <p>{done.garments.map((g) => g.name).join(', ')}</p>
            <div className="st-done-links">
              <Link className="btn btn-sm" to="/closet?view=where">집 밖/박스 보기</Link>
              {done.destination === 'LAUNDRY' && <Link className="btn btn-ghost" to="/care">관리함</Link>}
            </div>
          </div>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={() => setDone(null)}><Icon name="close" size={18} /></button>
        </div>
      )}

      <form className="st-move-grid" onSubmit={submit} noValidate>
        <div className="st-move-side">
          <section className="panel st-dest" aria-label="보낼 곳">
            <div className="chips st-dest-tabs" role="tablist" aria-label="보낼 곳 종류">
              <button type="button" role="tab" className="chip" data-on={dest === 'SPACE'} aria-selected={dest === 'SPACE'} onClick={() => setDest('SPACE')}>
                <Icon name="box" size={16} />박스·집 밖
              </button>
              <button type="button" role="tab" className="chip" data-on={dest === 'LAUNDRY'} aria-selected={dest === 'LAUNDRY'} onClick={() => setDest('LAUNDRY')}>
                <Icon name="drop" size={16} />세탁소
              </button>
            </div>

            {dest === 'SPACE' ? (
              <div className="field">
                <span id="st-move-place">보낼 곳</span>
                <PlaceRadios all={map.spaces} options={places} checked={newPlace ? null : spaceId} labelledBy="st-move-place"
                  onPick={(p) => { setSpaceId(p.id); setNewPlace(null) }}
                  note={(p) => `${p.spaceTypeLabel} · ${p.capacity ? `${p.count}/${p.capacity}벌` : `${p.count}벌`}`}>
                  <button type="button" role="radio" aria-checked={Boolean(newPlace)} data-on={Boolean(newPlace)} className="loc-row st-new"
                    onClick={() => setNewPlace(newPlace ?? { name: '', spaceType: 'BOX' })}>
                    <span className="radio">{newPlace ? <Icon name="check" size={13} stroke={3} /> : <Icon name="plus" size={13} stroke={2.4} />}</span>
                    새로 만들기
                  </button>
                </PlaceRadios>
                {newPlace && (
                  <div className="st-new-place">
                    <input aria-label="새 박스·장소 이름" placeholder="예: 박스 A, 본가" value={newPlace.name} maxLength={100}
                      onChange={(e) => setNewPlace({ ...newPlace, name: e.target.value })} />
                    <div className="chips" role="group" aria-label="새 장소 종류">
                      <button type="button" className="chip" data-on={newPlace.spaceType === 'BOX'} aria-pressed={newPlace.spaceType === 'BOX'} onClick={() => setNewPlace({ ...newPlace, spaceType: 'BOX' })}>박스</button>
                      <button type="button" className="chip" data-on={newPlace.spaceType === 'OFFSITE'} aria-pressed={newPlace.spaceType === 'OFFSITE'} onClick={() => setNewPlace({ ...newPlace, spaceType: 'OFFSITE' })}>집 밖</button>
                    </div>
                  </div>
                )}
                {places.length === 0 && !newPlace && <p className="st-field-hint">아직 박스·집 밖 장소가 없어요. ‘새로 만들기’로 만들어요.</p>}
              </div>
            ) : (
              <>
                <label className="field"><span>세탁소</span>
                  <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="예: 동네 세탁소" maxLength={100} />
                </label>
                <div className="st-due-group">
                  <label className="field"><span>회수 예정일</span>
                    <input type="date" value={dueOn} min={movedOn} onChange={(e) => setDueOn(e.target.value)} />
                  </label>
                  <div className="chips">
                    {QUICK.map(([l, n]) => {
                      const on = dueOn === addDays(movedOn, n)
                      return <button key={l} type="button" className="chip" data-on={on} aria-pressed={on} onClick={() => setDueOn(addDays(movedOn, n))}>{l}</button>
                    })}
                  </div>
                </div>
              </>
            )}

            <label className="field"><span>{dest === 'LAUNDRY' ? '맡긴 날' : '옮긴 날'}</span>
              <input type="date" value={movedOn} max={today} onChange={(e) => setMovedOn(e.target.value)} />
            </label>
          </section>

          <div className="st-submit">
            {error && <Notice>{error}</Notice>}
            <button type="submit" className="btn btn-primary btn-block" disabled={!ready || busy}>
              {busy && <Spinner />}
              {picked.length === 0 ? '옮길 옷을 골라 주세요'
                : dest === 'LAUNDRY' ? `${destName}에 맡김 (${picked.length}벌)`
                  : destName ? `${ro(destName)} 보냄 (${picked.length}벌)` : '보낼 곳을 골라 주세요'}
            </button>
          </div>
        </div>

        <section className="st-move-list" aria-label="옮길 옷">
          <div className="st-list-head">
            <h2 className="section-title">옮길 옷 <small>{picked.length}벌 선택</small></h2>
            <button type="button" className="link-btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} stroke={2.4} />처음 보는 옷</button>
          </div>
          <label className="search">
            <Icon name="search" size={19} />
            <input type="search" placeholder="이름·색상·위치로 찾기" aria-label="옮길 옷 찾기" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {choices.length === 0 ? (
            <div className="empty"><p>옮길 수 있는 옷이 없어요. 세탁·수선 중인 옷은 관리함에서 회수한 뒤 옮길 수 있어요.</p></div>
          ) : (
            <div className="st-picks" role="group" aria-label="옮길 옷 목록">
              {choices.map((g) => (
                <GarmentPick key={g.id} g={g} on={picked.includes(g.id)} onToggle={() => toggle(g.id)}
                  sub={g.locationPath ? `${g.locationKind === 'HOME' ? '' : `${g.locationKindLabel} · `}${g.locationPath}` : g.locationKindLabel} />
              ))}
            </div>
          )}
        </section>
      </form>

      {recent.length > 0 && (
        <section className="st-recent" aria-label="최근 옮긴 기록">
          <h2 className="section-title">최근 옮긴 기록</h2>
          <ul className="history">
            {recent.slice(0, 8).map((b) => (
              <li key={b.id}>
                <Icon name={b.destination === 'LAUNDRY' ? 'drop' : 'box'} size={15} stroke={2} />
                <span>
                  <b>{b.destination === 'LAUNDRY' ? `${b.shopName ?? '세탁소'}에 맡김` : `${ro(b.spacePath ?? '')} 보냄`}</b> · {b.garments.length}벌
                  {b.dueOn && <em className="st-history-sub">{formatDate(b.dueOn)} 회수 예정</em>}
                </span>
                <small>{formatDate(b.movedOn)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {adding && (
        <QuickAddSheet subTypes={meta?.subTypes ?? []} onClose={closeAdd}
          onAdded={(g) => { setGarments((list) => [g, ...(list ?? [])]); setPicked((p) => [...p, g.id]); setAdding(false) }} />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}

/** 처음 보는 옷: 이름·종류와 사진 한 장만 받아 바로 등록하고 묶음에 넣는다. 자세한 정보는 나중에 옷 상세에서 채운다. */
function QuickAddSheet({ subTypes, onClose, onAdded }: {
  subTypes: { value: string; label: string }[]; onClose: () => void; onAdded: (g: GarmentSummary) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [subType, setSubType] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const imageIds: number[] = []
      if (file) {
        const body = new FormData()
        body.append('file', file)
        imageIds.push((await api.post<{ id: number }>('/api/images', body)).id)
      }
      const created = await api.post<GarmentDetail>('/api/garments', { name, subType: subType || null, imageIds })
      onAdded((await processCoverIfNeeded(created).catch(() => created)).summary)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="처음 보는 옷 넣기" onClose={onClose}
      footer={
        <button type="submit" form="st-quick-add" className="btn btn-primary btn-block" disabled={busy || !name.trim() || !subType}>
          {busy && <Spinner />}등록하고 넣기
        </button>
      }>
      <form id="st-quick-add" className="fields st-quick" onSubmit={save} noValidate>
        <label className="field"><span>옷 이름 <i>*</i></span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 체크 셔츠" maxLength={100} />
        </label>
        <label className="field"><span>옷 종류 <i>*</i></span>
          <span className="st-select">
            <select value={subType} onChange={(e) => setSubType(e.target.value)}>
              <option value="">골라 주세요</option>
              {subTypes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <Icon name="chevronDown" size={16} />
          </span>
        </label>
        <div className="field">
          <span>옷 사진 (고르지 않아도 돼요)</span>
          <div className="photo-row">
            {preview && <div className="photo"><img src={preview} alt="옷 사진" /></div>}
            <label className="photo add">
              <Icon name="camera" size={22} />{file ? '다시 찍기' : '사진 한 장'}
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="옷 사진"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
            </label>
          </div>
        </div>
        <p className="hint">택·소재·세탁법은 나중에 옷 상세의 ‘정보 수정’에서 채울 수 있어요.</p>
        {error && <Notice>{error}</Notice>}
      </form>
    </Sheet>
  )
}
