import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, errorMessage } from '../api'
import { GarmentTile } from '../components/GarmentCard'
import { IconBack, IconNeedle, IconPin, IconPinQuestion, IconWash } from '../components/Icons'
import { Loading, Notice, Sheet, Spinner, Toast } from '../components/Ui'
import { formatDate } from '../format'
import GarmentForm from '../components/GarmentForm'
import { processGarmentImage } from '../imageCleanup'
import { toInput, type GarmentFormValue } from '../garmentForm'
import { useSession } from '../session'
import type { GarmentDetail, MapView } from '../types'

export default function GarmentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { refreshBadge } = useSession()
  const [d, setD] = useState<GarmentDetail | null>(null)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [sheet, setSheet] = useState<'edit' | 'care' | 'move' | 'delete' | null>(null)
  const [photo, setPhoto] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.get<GarmentDetail>(`/api/garments/${id}`)
      .then((x) => { setD(x); setError('') })
      .catch((e) => (e instanceof ApiError && e.status === 404 ? setNotFound(true) : setError(errorMessage(e))))
  }, [id])
  useEffect(load, [load])

  if (notFound) {
    return <div className="empty"><strong>이 옷을 찾을 수 없어요</strong><p>삭제됐거나 다른 계정의 옷이에요.</p><Link className="btn" to="/closet">내 옷장</Link></div>
  }
  if (!d) return error ? <Notice>{error}</Notice> : <Loading />

  const s = d.summary
  const away = s.status === 'WASHING' || s.status === 'REPAIRING'
  const openCare = d.careHistory.find((c) => !c.completedAt)
  const shown = d.images.find((i) => i.id === photo)

  async function confirmPlacement(spaceId?: number) {
    setBusy(true)
    try {
      const next = await api.post<GarmentDetail>(`/api/garments/${s.id}/confirm-placement`, spaceId ? { spaceId } : undefined)
      setD(next)
      setSheet(null)
      setToast(spaceId ? '위치를 바꿨어요' : '위치를 확인했어요')
      refreshBadge()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/closet'))} aria-label="뒤로"><IconBack /></button>
        <h1>옷 정보</h1>
        <span />
      </div>

      <div className="detail-layout">
        <div className="detail-aside">
          <div className="hero-tile">
            {shown ? <div className="gcard-tile"><img src={shown.url} alt="선택한 사진" /></div> : <GarmentTile g={s} />}
            {d.images.length > 0 && (
              <div className="thumbs" role="group" aria-label="사진">
                <button type="button" aria-pressed={photo === null} onClick={() => setPhoto(null)} aria-label="대표 이미지"><GarmentThumb d={d} /></button>
                {d.images.map((img) => (
                  <button key={img.id} type="button" aria-pressed={photo === img.id} onClick={() => setPhoto(img.id)}
                    aria-label={KIND_LABEL[img.kind] ?? '사진'} data-kind={img.kind}>
                    <img src={img.url} alt={KIND_LABEL[img.kind] ?? '사진'} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <CoverSection d={d} onChange={(next, message) => { setD(next); setPhoto(null); setToast(message) }} />
        </div>

        <div>
          <h2 className="detail-title">{s.name}</h2>
          <p className="detail-sub">{[s.subTypeLabel, s.brand].filter(Boolean).join(', ')}</p>
          {s.seasons.length > 0 && (
            <div className="chips wrap" aria-label="계절">
              {s.seasons.map((x) => <span key={x} className="chip chip-static">{seasonLabel(x)}</span>)}
            </div>
          )}

          {error && <div style={{ marginTop: 12 }}><Notice>{error}</Notice></div>}

          <LocationCard d={d} busy={busy} onConfirm={() => confirmPlacement()} />

          <dl className="info-table">
            <Row k="종류" v={`${s.categoryLabel} / ${s.subTypeLabel}`} />
            <Row k="색상" v={s.colorName} swatch={s.colorHex} />
            <Row k="브랜드" v={s.brand} />
            <Row k="사이즈" v={d.sizeLabel} />
            <Row k="품번" v={d.productCode} />
            <Row k="원산지" v={d.origin} />
            <Row k="소재" v={d.materials.length ? d.materials.map((m) => `${m.partLabel} ${m.fiberLabel} ${m.percent}%`).join(', ') : null} />
            <Row k="총장" v={s.totalLengthCm ? `${s.totalLengthCm}cm` : null} />
            <Row k="상태" v={s.statusLabel} />
            <Row k="컬렉션" v={s.collections.join(', ') || null} />
          </dl>

          <section className="section">
            <h3 className="section-title">세탁·관리 정보</h3>
            {d.careLines.length > 0 ? (
              <ul className="card list-plain">{d.careLines.map((l, i) => <li key={i}>{l}</li>)}</ul>
            ) : (
              <div className="empty"><p>등록된 관리 정보가 없어요. ‘정보 수정’에서 택에 적힌 세탁법을 한 줄씩 적을 수 있어요.</p></div>
            )}
          </section>

          <section className="section" aria-label="세탁·수선">
            <h3 className="section-title">세탁·수선</h3>
            {openCare ? (
              <div className="card">
                <strong>{openCare.careTypeLabel} 중</strong>
                <p className="row-sub" style={{ margin: '4px 0 12px' }}>
                  {[openCare.placeLabel === '업체' ? openCare.shopName : '자택', `${formatDate(openCare.droppedOn)} 맡김`,
                    openCare.dueOn ? `${formatDate(openCare.dueOn)} 회수 예정` : '회수 예정일 미정'].filter(Boolean).join(', ')}
                </p>
                <Link className="btn btn-sm btn-outline" to="/care">관리함에서 보기</Link>
              </div>
            ) : (
              <button type="button" className="btn btn-accent-outline" onClick={() => setSheet('care')}>
                <IconWash />세탁·수선 맡기기
              </button>
            )}
            {d.careHistory.filter((c) => c.completedAt).length > 0 && (
              <ul className="list-plain" aria-label="관리 이력" style={{ marginTop: 12 }}>
                {d.careHistory.filter((c) => c.completedAt).map((c) => (
                  <li key={c.id}>
                    <span>{c.careTypeLabel}{c.shopName ? ` · ${c.shopName}` : ''}</span>
                    <span className="row-sub">{formatDate(c.droppedOn)} 맡김, {formatDate(c.completedAt)} 회수 완료</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <LabelSection d={d} />
          <ProductSection d={d} />

          <div className="actionbar">
            <button type="button" className="btn" onClick={() => setSheet('move')} disabled={away}>위치 변경</button>
            <button type="button" className="btn btn-outline" onClick={() => setSheet('edit')}>정보 수정</button>
            <button type="button" className="btn-danger-text btn" onClick={() => setSheet('delete')}>삭제</button>
          </div>
        </div>
      </div>

      {sheet === 'edit' && (
        <EditSheet d={d} onClose={() => setSheet(null)} onSaved={(next) => { setD(next); setSheet(null); setToast('저장했어요') }} />
      )}
      {sheet === 'care' && (
        <CareSheet garmentId={s.id} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); refreshBadge(); setToast('세탁·수선을 기록했어요') }} />
      )}
      {sheet === 'move' && (
        <MoveSheet current={s.spaceId} busy={busy} onClose={() => setSheet(null)} onPick={(spaceId) => confirmPlacement(spaceId)} />
      )}
      {sheet === 'delete' && (
        <Sheet title="이 옷을 삭제할까요?" onClose={() => setSheet(null)}>
          <p className="page-lead" style={{ margin: 0 }}>사진, 택 분석, 위치, 세탁·수선 기록, 이 옷이 들어간 코디가 함께 지워져요. 되돌릴 수 없어요.</p>
          <div className="sheet-actions">
            <button type="button" className="btn btn-outline" onClick={() => setSheet(null)}>취소</button>
            <button type="button" className="btn" style={{ background: 'var(--danger)' }}
              onClick={async () => { await api.del(`/api/garments/${s.id}`).catch((e) => setError(errorMessage(e))); navigate('/closet', { replace: true }) }}>
              삭제하기
            </button>
          </div>
        </Sheet>
      )}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </>
  )
}

const KIND_LABEL: Record<string, string> = { LABEL: '택 사진', PROCESSED: '정리된 대표 이미지', PRODUCT_ORIGINAL: '제품 이미지', GARMENT_ORIGINAL: '옷 사진' }

/** 대표 이미지 정리 결과: 정리본과 원본을 나란히 보여 주고, 실패했거나 마음에 들지 않으면 다시 처리한다. */
function CoverSection({ d, onChange }: { d: GarmentDetail; onChange: (d: GarmentDetail, message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cover = d.images.find((i) => i.id === d.coverImageId)
  const source = cover?.kind === 'PROCESSED' ? d.images.find((i) => i.id === cover.processedFromId)
    : cover && (cover.kind === 'GARMENT_ORIGINAL' || cover.kind === 'PRODUCT_ORIGINAL') ? cover : undefined
  if (!source) return null
  const result = d.images.find((i) => i.processedFromId === source.id)

  async function run() {
    setBusy(true)
    setError('')
    try {
      const { detail, error: failure } = await processGarmentImage(d.summary.id, source!.id)
      if (failure) setError(failure)
      onChange(detail, failure ? '원본을 대표 이미지로 유지했어요' : '대표 이미지를 정리했어요')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card cover-card" aria-label="대표 이미지 정리">
      <h3 className="section-title">대표 이미지</h3>
      {source.processing === 'DONE' && result ? (
        <div className="cover-compare">
          <figure><div className="cover-img checker"><img src={result.url} alt="정리된 대표 이미지" /></div><figcaption>정리본</figcaption></figure>
          <figure><div className="cover-img"><img src={source.url} alt="원본 사진" /></div><figcaption>원본</figcaption></figure>
        </div>
      ) : source.processing === 'FAILED' ? (
        <Notice kind="warn">배경을 지우지 못해 원본 사진을 대표 이미지로 쓰고 있어요.</Notice>
      ) : (
        <p className="field-hint" style={{ margin: 0 }}>아직 정리하지 않은 원본 사진이에요. 배경을 지우고 가운데 맞출 수 있어요.</p>
      )}
      {error && <div style={{ marginTop: 8 }}><Notice kind="warn">{error}</Notice></div>}
      <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 10 }} onClick={run} disabled={busy}>
        {busy && <Spinner />}{source.processing ? '다시 처리' : '대표 이미지 정리'}
      </button>
    </section>
  )
}

function seasonLabel(s: string) {
  return ({ SPRING: '봄', SUMMER: '여름', AUTUMN: '가을', WINTER: '겨울' } as Record<string, string>)[s] ?? s
}

function GarmentThumb({ d }: { d: GarmentDetail }) {
  return <div style={{ width: '100%', height: '100%' }}><GarmentTile g={{ ...d.summary, status: 'STORED' }} /></div>
}

function Row({ k, v, swatch }: { k: string; v: string | null | undefined; swatch?: string | null }) {
  return (
    <div className="info-row">
      <dt>{k}</dt>
      <dd className={v ? '' : 'empty-val'}>
        {swatch && <span aria-hidden style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 4, background: swatch, marginRight: 6, verticalAlign: '-1px', border: '1px solid rgb(0 0 0 / .1)' }} />}
        {v || '미입력'}
      </dd>
    </div>
  )
}

function LocationCard({ d, busy, onConfirm }: { d: GarmentDetail; busy: boolean; onConfirm: () => void }) {
  const s = d.summary
  if (s.status === 'WASHING' || s.status === 'REPAIRING') {
    return (
      <div className="loc-card away">
        <span className="loc-icon">{s.status === 'WASHING' ? <IconWash /> : <IconNeedle />}</span>
        <div><div className="loc-label">지금 상태</div><div className="loc-path">{s.statusLabel}이라 집에 없어요</div></div>
      </div>
    )
  }
  if (s.status === 'RETURNED_UNPLACED') {
    return (
      <div className="loc-card unplaced">
        <span className="loc-icon"><IconPinQuestion /></span>
        <div>
          <div className="loc-label">회수 완료, 위치 확인 필요</div>
          <div className="loc-path">{d.suggestedLocationPath ? `제안 위치: ${d.suggestedLocationPath}` : '넣을 공간을 정해 주세요'}</div>
        </div>
        {d.suggestedLocationPath && (
          <button type="button" className="btn btn-sm loc-action" onClick={onConfirm} disabled={busy}>{busy && <Spinner />}재배치 확인</button>
        )}
      </div>
    )
  }
  if (s.locationPath) {
    return (
      <div className="loc-card">
        <span className="loc-icon"><IconPin /></span>
        <div><div className="loc-label">보관 위치</div><div className="loc-path">{s.locationPath}</div></div>
      </div>
    )
  }
  return (
    <div className="loc-card unplaced">
      <span className="loc-icon"><IconPinQuestion /></span>
      <div><div className="loc-label">보관 위치</div><div className="loc-path">미배치</div></div>
      <Link className="btn btn-sm btn-outline loc-action" to="/map">옷장 지도</Link>
    </div>
  )
}

function LabelSection({ d }: { d: GarmentDetail }) {
  const e = d.extraction
  if (!e) return null
  return (
    <section className="section" aria-label="택에서 읽은 정보">
      <h3 className="section-title">택에서 읽은 정보</h3>
      <div className="card">
        {e.status === 'FAILED' ? <Notice kind="warn">택을 읽지 못했어요: {e.errorMessage}</Notice> : (
          <table className="read-table">
            <tbody>
              {e.values.map((v) => (
                <tr key={v.field}>
                  <th scope="row">{v.fieldLabel}</th>
                  <td>
                    {v.correctedValue ?? v.readValue ?? '읽지 못함'}
                    {v.unread && <span className="field-flag">확인 필요</span>}
                    {v.correctedValue && v.readValue && v.correctedValue !== v.readValue && <span className="row-sub"> (택: {v.readValue})</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {e.rawText && (
          <details style={{ marginTop: 12 }}>
            <summary className="field-hint" style={{ cursor: 'pointer' }}>택 원문 보기</summary>
            <div className="raw-text" style={{ marginTop: 8 }}>{e.rawText}</div>
          </details>
        )}
      </div>
    </section>
  )
}

function ProductSection({ d }: { d: GarmentDetail }) {
  if (!d.product && !d.search) return null
  return (
    <section className="section" aria-label="제품 정보">
      <h3 className="section-title">제품 정보</h3>
      {d.product ? (
        <div className="card">
          <strong>{d.product.name}</strong>
          <p className="row-sub" style={{ margin: '4px 0 0' }}>
            <a href={d.product.sourceUrl} target="_blank" rel="noreferrer noopener">출처 페이지 열기</a>
            {d.product.searchedAt && `, ${formatDate(d.product.searchedAt)} 조회`}
          </p>
        </div>
      ) : d.search?.status === 'FAILED' ? (
        <Notice kind="warn">제품 검색에 실패해 직접 입력한 정보로 등록했어요.</Notice>
      ) : d.search && d.search.candidates.length === 0 ? (
        <Notice kind="info">검색 결과 없음: 택 정보와 직접 입력한 값으로 등록했어요.</Notice>
      ) : (
        <div className="cand-list" aria-label="제품 후보">
          <p className="field-hint" style={{ margin: 0 }}>찾은 제품 후보 {d.search!.candidates.length}개 중 선택하지 않았어요.</p>
          {d.search!.candidates.map((c) => (
            <a key={c.id} className="cand" href={c.sourceUrl} target="_blank" rel="noreferrer noopener" data-testid="product-candidate">
              <span className="cand-img">{c.imageUrl ? <img src={c.imageUrl} alt="" referrerPolicy="no-referrer" /> : '사진 없음'}</span>
              <span><span className="cand-name">{c.name}</span><br /><span className="cand-meta">{c.matchReason}</span></span>
            </a>
          ))}
        </div>
      )}
    </section>
  )
}

function EditSheet({ d, onClose, onSaved }: { d: GarmentDetail; onClose: () => void; onSaved: (d: GarmentDetail) => void }) {
  const [value, setValue] = useState<GarmentFormValue>(() => ({
    name: d.summary.name, subType: d.summary.subType, brand: d.summary.brand ?? '', productCode: d.productCode ?? '',
    colorName: d.summary.colorName ?? '', colorHex: d.summary.colorHex ?? '', sizeLabel: d.sizeLabel ?? '', origin: d.origin ?? '',
    seasons: d.summary.seasons, collections: d.summary.collections.join(', '), wearFrequency: d.summary.wearFrequency,
    materials: d.materials.map((m) => ({ part: m.part, fiber: m.fiber, percent: String(m.percent) })),
    careLines: d.careLines.join('\n'),
    totalLengthCm: d.summary.totalLengthCm ? String(d.summary.totalLengthCm) : '',
    otherMeasurements: d.measurements.filter((m) => !(m.part === 'TOTAL_LENGTH' && m.kind === 'LENGTH'))
      .map((m) => ({ part: m.part, kind: m.kind, valueCm: m.valueCm, source: m.source })),
  }))
  const [homeStatus, setHomeStatus] = useState(d.homeStatus)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const away = d.summary.status === 'WASHING' || d.summary.status === 'REPAIRING'

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      let next = await api.put<GarmentDetail>(`/api/garments/${d.summary.id}`, toInput(value))
      if (homeStatus !== d.homeStatus) {
        next = await api.patch<GarmentDetail>(`/api/garments/${d.summary.id}/status`, { status: homeStatus })
      }
      onSaved(next)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="정보 수정" onClose={onClose}>
      <form onSubmit={save} className="form-grid" noValidate>
        <GarmentForm value={value} onChange={setValue} />
        <div className="field">
          <label htmlFor="home-status">집 안 상태</label>
          <select id="home-status" className="select" value={homeStatus} onChange={(e) => setHomeStatus(e.target.value)} disabled={away}>
            <option value="STORED">보관 중</option>
            <option value="PENDING">착용·보관 전</option>
            <option value="WASH_WAITING">세탁 대기</option>
          </select>
          {away && <span className="field-hint">세탁·수선 중에는 관리함에서 회수 완료를 먼저 눌러 주세요.</span>}
        </div>
        {error && <Notice>{error}</Notice>}
        <div className="sheet-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
          <button type="submit" className="btn" disabled={busy}>{busy && <Spinner />}저장</button>
        </div>
      </form>
    </Sheet>
  )
}

function CareSheet({ garmentId, onClose, onSaved }: { garmentId: number; onClose: () => void; onSaved: () => void }) {
  const today = new Date()
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [careType, setCareType] = useState('WASH')
  const [place, setPlace] = useState('SHOP')
  const [shopName, setShopName] = useState('')
  const [description, setDescription] = useState('')
  const [droppedOn, setDroppedOn] = useState(iso(today))
  const [dueOn, setDueOn] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post(`/api/garments/${garmentId}/care`, {
        careType, place, shopName: place === 'SHOP' ? shopName : null, description, droppedOn, dueOn: dueOn || null,
      })
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="세탁·수선 맡기기" onClose={onClose}>
      <form onSubmit={save} className="form-grid" noValidate>
        <div className="field">
          <span className="field-label" id="care-type">종류</span>
          <div className="chips wrap" role="group" aria-labelledby="care-type" style={{ marginTop: 0 }}>
            <button type="button" className="chip" aria-pressed={careType === 'WASH'} onClick={() => setCareType('WASH')}>세탁</button>
            <button type="button" className="chip" aria-pressed={careType === 'REPAIR'} onClick={() => setCareType('REPAIR')}>수선</button>
          </div>
        </div>
        <div className="field">
          <span className="field-label" id="care-place">맡긴 곳</span>
          <div className="chips wrap" role="group" aria-labelledby="care-place" style={{ marginTop: 0 }}>
            <button type="button" className="chip" aria-pressed={place === 'SHOP'} onClick={() => setPlace('SHOP')}>업체</button>
            <button type="button" className="chip" aria-pressed={place === 'HOME'} onClick={() => setPlace('HOME')}>자택</button>
          </div>
        </div>
        {place === 'SHOP' && (
          <div className="field">
            <label htmlFor="shop">업체명</label>
            <input id="shop" className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="예: 동네 세탁소" />
          </div>
        )}
        <div className="field">
          <label htmlFor="care-desc">내용</label>
          <input id="care-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={careType === 'WASH' ? '예: 드라이클리닝' : '예: 밑단 3cm 줄임'} />
        </div>
        <div className="form-grid two">
          <div className="field">
            <label htmlFor="dropped">맡긴 날짜</label>
            <input id="dropped" className="input" type="date" value={droppedOn} max={iso(today)} onChange={(e) => setDroppedOn(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="due">회수 예정일</label>
            <input id="due" className="input" type="date" value={dueOn} min={droppedOn} onChange={(e) => setDueOn(e.target.value)} />
          </div>
        </div>
        {error && <Notice>{error}</Notice>}
        <div className="sheet-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
          <button type="submit" className="btn" disabled={busy}>{busy && <Spinner />}기록하기</button>
        </div>
      </form>
    </Sheet>
  )
}

function MoveSheet({ current, busy, onClose, onPick }: { current: number | null; busy: boolean; onClose: () => void; onPick: (spaceId: number) => void }) {
  const [map, setMap] = useState<MapView | null>(null)
  const [pick, setPick] = useState<number | null>(current)
  const [error, setError] = useState('')
  useEffect(() => { api.get<MapView>('/api/spaces').then(setMap).catch((e) => setError(errorMessage(e))) }, [])
  const leaves = map?.spaces.filter((s) => !map.spaces.some((o) => o.parentId === s.id)) ?? []
  return (
    <Sheet title="위치 변경" onClose={onClose}>
      {error && <Notice>{error}</Notice>}
      {!map && !error && <Loading />}
      {map && leaves.length === 0 && (
        <div className="empty"><p>아직 수납 공간이 없어요. 옷장 지도에서 공간을 먼저 만들어 주세요.</p><Link className="btn" to="/map">옷장 지도</Link></div>
      )}
      <div className="form-grid" role="radiogroup" aria-label="옮길 공간">
        {leaves.map((s) => (
          <button key={s.id} type="button" className="cand" style={{ gridTemplateColumns: '1fr auto' }} aria-pressed={pick === s.id} onClick={() => setPick(s.id)}>
            <span><span className="cand-name">{s.path}</span><br /><span className="cand-meta">{s.spaceTypeLabel}{s.capacity ? `, ${s.count}/${s.capacity}벌` : `, ${s.count}벌`}</span></span>
            {s.id === current && <span className="chip chip-static">지금 위치</span>}
          </button>
        ))}
      </div>
      <p className="field-hint">실제로 옷을 옮겨 넣은 뒤 눌러 주세요. 누른 시점부터 이 위치로 보여요.</p>
      <div className="sheet-actions">
        <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
        <button type="button" className="btn" disabled={!pick || busy} onClick={() => pick && onPick(pick)}>{busy && <Spinner />}여기로 옮김</button>
      </div>
    </Sheet>
  )
}
