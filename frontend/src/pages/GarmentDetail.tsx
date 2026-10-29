import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, errorMessage } from '../api'
import { GarmentPicture } from '../components/GarmentCard'
import { Icon } from '../components/Icon'
import StatusPill from '../components/StatusPill'
import { SpaceList } from '../components/TakeOutSheet'
import { Loading, Notice, Sheet, Spinner, Toast } from '../components/Ui'
import { formatDate } from '../format'
import GarmentForm from '../components/GarmentForm'
import { processGarmentImage } from '../imageCleanup'
import { nearestColorName } from '../colors'
import { toInput, type GarmentFormValue } from '../garmentForm'
import { useSession } from '../session'
import type { CareView, GarmentDetail, MapView } from '../types'
import '../styles/closet.app.css'

/** 옷 정보(디자인 초안 GarmentDetail). 휴대폰은 한 줄로 쌓고, PC는 왼쪽에 그림·오른쪽에 정보를 둔다. */
export default function GarmentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { meta, refreshBadge } = useSession()
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
    return (
      <div className="page notfound">
        <h1>이 옷을 찾을 수 없어요</h1>
        <p>삭제됐거나 다른 계정의 옷이에요.</p>
        <Link className="btn btn-primary" to="/closet">내 옷장</Link>
      </div>
    )
  }

  const topbar = (
    <div className="pin">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/closet'))} aria-label="뒤로">
          <Icon name="chevronLeft" size={24} />
        </button>
        <h1>옷 정보</h1>
        <span className="topbar-gap" />
      </header>
    </div>
  )
  if (!d) return <div className="page pinned detail">{topbar}{error ? <Notice>{error}</Notice> : <Loading />}</div>

  const s = d.summary
  const away = s.status === 'WASHING' || s.status === 'REPAIRING'
  const openCare = d.careHistory.find((c) => !c.completedAt)
  const pastCare = d.careHistory.filter((c) => c.completedAt)
  const shown = d.images.find((i) => i.id === photo)
  const unplaced = !s.locationPath && s.locationKind === 'UNPLACED' && s.status !== 'RETURNED_UNPLACED'

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
    <div className="page pinned detail">
      {topbar}

      <div className="detail-body">
        <div className="detail-media">
          <div className="hero-card">
            <div className="hero-tile">
              {shown
                ? <span className="gfill"><img className="hero-photo" src={shown.url} alt="선택한 사진" /></span>
                : <GarmentPicture g={s} size="82%" alt={`${s.name} 대표 이미지`} />}
            </div>
            {d.images.length > 0 && (
              <div className="hero-thumbs" role="group" aria-label="사진">
                <button type="button" className="hero-thumb" aria-pressed={photo === null} onClick={() => setPhoto(null)} aria-label="대표 이미지">
                  <GarmentPicture g={s} size="78%" />
                </button>
                {d.images.map((img) => (
                  <button key={img.id} type="button" className="hero-thumb" aria-pressed={photo === img.id} onClick={() => setPhoto(img.id)}
                    aria-label={KIND_LABEL[img.kind] ?? '사진'} data-kind={img.kind}>
                    <img src={img.url} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="detail-info">
          <div className="title-row">
            <h2>{s.name}</h2>
            <StatusPill status={s.status} label={s.statusLabel} size="lg" />
            {unplaced && <StatusPill status="UNPLACED" label="미배치" size="lg" />}
          </div>
          <div className="season-tags" aria-label="계절">
            {s.seasons.length ? s.seasons.map((x) => <span key={x} className="tag">{seasonLabel(x)}</span>) : <span className="tag muted">계절 미입력</span>}
          </div>

          {openCare && <CareBanner care={openCare} today={meta?.today} />}
          {error && <div className="detail-notice"><Notice>{error}</Notice></div>}

          <LocationCard d={d} busy={busy} onConfirm={() => confirmPlacement()} />

          <dl className="info-grid info-table">
            <Row k="종류" v={`${s.categoryLabel} / ${s.subTypeLabel}`} wide />
            <Row k="색상" v={s.colorName || nearestColorName(s.colorHex)} swatch={s.colorHex} />
            <Row k="브랜드" v={s.brand} />
            <Row k="사이즈" v={d.sizeLabel} />
            <Row k="품번" v={d.productCode} />
            <Row k="원산지" v={d.origin} />
            <Row k="총장" v={s.totalLengthCm ? `${s.totalLengthCm}cm` : null} />
            <Row k="상태" v={s.statusLabel} />
            <Row k="컬렉션" v={s.collections.join(', ') || null} />
            <Row k="소재" v={d.materials.length ? d.materials.map((m) => `${m.partLabel} ${m.fiberLabel} ${m.percent}%`).join(', ') : null} wide />
          </dl>

          <section>
            <h3 className="section-title">세탁·관리 정보</h3>
            {d.careLines.length > 0 ? (
              <ul className="care-lines">{d.careLines.map((l, i) => <li key={i}><Icon name="drop" size={15} stroke={2} />{l}</li>)}</ul>
            ) : (
              <div className="care-card">
                <p>등록된 관리 정보가 없어요. ‘정보 수정’에서 택에 적힌 세탁법을 한 줄씩 적을 수 있어요.</p>
              </div>
            )}
          </section>

          {(!openCare || pastCare.length > 0) && (
            <section aria-label="세탁·수선">
              <h3 className="section-title">세탁·수선</h3>
              {/* 맡긴 중이면 위의 배너(관리함에서 보기)로 대신한다 */}
              {!openCare && (
                <button type="button" className="btn btn-outline" onClick={() => setSheet('care')}>
                  <Icon name="drop" size={18} />세탁·수선 맡기기
                </button>
              )}
              {pastCare.length > 0 && (
                <ul className="plain-list care-history" aria-label="관리 이력">
                  {pastCare.map((c) => (
                    <li key={c.id} className="row-link">
                      <span className="mini-tile"><Icon name={c.careType === 'REPAIR' ? 'scissors' : 'drop'} size={20} /></span>
                      <span className="row-main">
                        <b>{c.careTypeLabel}{c.shopName ? ` · ${c.shopName}` : ''}</b>
                        <small>{formatDate(c.droppedOn)} 맡김, {formatDate(c.completedAt)} 회수 완료</small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <CoverSection d={d} onChange={(next, message) => { setD(next); setPhoto(null); setToast(message) }} />
          <LabelSection d={d} />
          <ProductSection d={d} />

          <div className="action-bar">
            <button type="button" className="btn btn-primary" onClick={() => setSheet('move')} disabled={away}>위치 변경</button>
            <button type="button" className="btn btn-ghost" onClick={() => setSheet('edit')}>정보 수정</button>
            <button type="button" className="link-btn muted" onClick={() => setSheet('delete')}>삭제</button>
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
        <Sheet title="이 옷을 삭제할까요?" onClose={() => setSheet(null)}
          footer={
            <div className="foot-row">
              <button type="button" className="btn btn-ghost" onClick={() => setSheet(null)}>취소</button>
              <button type="button" className="btn btn-danger"
                onClick={async () => { await api.del(`/api/garments/${s.id}`).catch((e) => setError(errorMessage(e))); navigate('/closet', { replace: true }) }}>
                삭제하기
              </button>
            </div>
          }>
          <p className="sheet-text">사진, 택 분석, 위치, 세탁·수선 기록, 이 옷이 들어간 코디가 함께 지워져요. 되돌릴 수 없어요.</p>
        </Sheet>
      )}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  )
}

const KIND_LABEL: Record<string, string> = { LABEL: '택 사진', PROCESSED: '정리된 대표 이미지', PRODUCT_ORIGINAL: '제품 이미지', GARMENT_ORIGINAL: '옷 사진' }

function seasonLabel(s: string) {
  return ({ SPRING: '봄', SUMMER: '여름', AUTUMN: '가을', WINTER: '겨울' } as Record<string, string>)[s] ?? s
}

/** 정보 한 칸(디자인 초안 .info-grid .cell). wide는 한 줄을 다 쓴다(소재처럼 긴 값). */
function Row({ k, v, swatch, wide }: { k: string; v: string | null | undefined; swatch?: string | null; wide?: boolean }) {
  return (
    <div className={`cell info-row${wide ? ' wide' : ''}`}>
      <dt>{k}</dt>
      <dd className={v ? '' : 'unset'}>
        {v && swatch && <span className="info-swatch" aria-hidden style={{ background: swatch }} />}
        {v || '미입력'}
      </dd>
    </div>
  )
}

/** 세탁·수선 맡긴 중(디자인 초안 .care-banner). 회수 예정일이 지났으면 붉게 표시하고 문구로도 알린다. */
function CareBanner({ care, today }: { care: CareView; today?: string }) {
  const late = Boolean(care.dueOn && today && care.dueOn < today)
  return (
    <div className={`care-banner${late ? ' late' : ''}`}>
      <Icon name={care.careType === 'REPAIR' ? 'scissors' : 'drop'} size={20} />
      <div>
        <b>{care.careTypeLabel} 중</b>
        <small>
          {[care.placeLabel === '업체' ? care.shopName : '자택', `${formatDate(care.droppedOn)} 맡김`,
            care.dueOn ? `${formatDate(care.dueOn)} 회수 예정` : '회수 예정일 미정', late ? '기한 지남' : ''].filter(Boolean).join(', ')}
        </small>
      </div>
      <Link className="btn btn-sm" to="/care">관리함에서 보기</Link>
    </div>
  )
}

/** 보관 위치(디자인 초안 .loc-card). 세탁·수선 중, 돌려받아 확인할 위치, 확정 위치, 미배치를 구분한다. */
function LocationCard({ d, busy, onConfirm }: { d: GarmentDetail; busy: boolean; onConfirm: () => void }) {
  const s = d.summary
  if (s.status === 'WASHING' || s.status === 'REPAIRING') {
    return (
      <div className="loc-card away">
        <span className="loc-icon"><Icon name={s.status === 'WASHING' ? 'drop' : 'scissors'} size={22} /></span>
        <div><small>지금 상태</small><b className="loc-path">{s.statusLabel}이라 집에 없어요</b></div>
      </div>
    )
  }
  if (s.status === 'RETURNED_UNPLACED') {
    return (
      <div className="loc-card suggest">
        <span className="loc-icon"><Icon name="pin" size={22} /></span>
        <div>
          <small>회수 완료, 위치 확인 필요</small>
          <b className="loc-path">{d.suggestedLocationPath ? `제안 위치: ${d.suggestedLocationPath}` : '넣을 공간을 정해 주세요'}</b>
        </div>
        {d.suggestedLocationPath && (
          <button type="button" className="btn btn-sm loc-action" onClick={onConfirm} disabled={busy}>{busy && <Spinner />}재배치 확인</button>
        )}
      </div>
    )
  }
  if (s.locationPath) {
    const awayKind = s.locationKind === 'BOX' || s.locationKind === 'OFFSITE'
    return (
      <div className="loc-card">
        <span className="loc-icon"><Icon name={awayKind ? 'box' : 'pin'} size={22} /></span>
        <div><small>보관 위치{awayKind ? ` · ${s.locationKindLabel}` : ''}</small><b className="loc-path">{s.locationPath}</b></div>
      </div>
    )
  }
  return (
    <div className="loc-card unplaced">
      <span className="loc-icon"><Icon name="pin" size={22} /></span>
      <div><small>보관 위치</small><b className="loc-path">미배치</b></div>
      <Link className="btn btn-sm loc-action" to="/map">옷장 지도</Link>
    </div>
  )
}

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
    <section aria-label="대표 이미지 정리">
      <h3 className="section-title">대표 이미지</h3>
      <div className="cover-card">
        {source.processing === 'DONE' && result ? (
          <div className="cover-compare">
            <figure><div className="cover-img is-cut"><img src={result.url} alt="정리된 대표 이미지" /></div><figcaption>정리본</figcaption></figure>
            <figure><div className="cover-img"><img src={source.url} alt="원본 사진" /></div><figcaption>원본</figcaption></figure>
          </div>
        ) : source.processing === 'FAILED' ? (
          <Notice kind="warn">배경을 지우지 못해 원본 사진을 대표 이미지로 쓰고 있어요.</Notice>
        ) : (
          <p className="hint cover-hint">아직 정리하지 않은 원본 사진이에요. 배경을 지우고 가운데 맞출 수 있어요.</p>
        )}
        {error && <div className="detail-notice"><Notice kind="warn">{error}</Notice></div>}
        <button type="button" className="btn btn-outline" onClick={run} disabled={busy}>
          {busy ? <Spinner /> : <Icon name="sparkle" size={16} />}{source.processing ? '다시 처리' : '대표 이미지 정리'}
        </button>
      </div>
    </section>
  )
}

/** 택 AI 분석 결과. 읽지 못한 값은 '확인 필요'로, 고친 값은 택 원래 값과 함께 보여 준다. */
function LabelSection({ d }: { d: GarmentDetail }) {
  const e = d.extraction
  if (!e) return null
  return (
    <section aria-label="택에서 읽은 정보">
      <h3 className="section-title">택에서 읽은 정보</h3>
      {e.status === 'FAILED' ? <Notice kind="warn">택을 읽지 못했어요: {e.errorMessage}</Notice> : (
        <div className="read-card">
          <dl className="read-grid">
            {e.values.map((v) => (
              <div key={v.field} className="cell">
                <dt>{v.fieldLabel}</dt>
                <dd className={v.correctedValue ?? v.readValue ? '' : 'unset'}>
                  {v.correctedValue ?? v.readValue ?? '읽지 못함'}
                  {v.unread && <span className="read-flag">확인 필요</span>}
                  {v.correctedValue && v.readValue && v.correctedValue !== v.readValue && <span className="read-orig"> (택: {v.readValue})</span>}
                </dd>
              </div>
            ))}
          </dl>
          {e.rawText && (
            <details className="read-raw">
              <summary>택 원문 보기</summary>
              <div className="read-raw-text">{e.rawText}</div>
            </details>
          )}
        </div>
      )}
    </section>
  )
}

/** 제품 후보 웹 검색 결과. 고른 제품, 실패, 결과 없음, 고르지 않은 후보를 구분한다. */
function ProductSection({ d }: { d: GarmentDetail }) {
  if (!d.product && !d.search) return null
  return (
    <section aria-label="제품 정보">
      <h3 className="section-title">제품 정보</h3>
      {d.product ? (
        <div className="row-link">
          <span className="mini-tile"><Icon name="tag" size={20} /></span>
          <span className="row-main">
            <b>{d.product.name}</b>
            <small>
              <a className="text-link" href={d.product.sourceUrl} target="_blank" rel="noreferrer noopener">출처 페이지 열기</a>
              {d.product.searchedAt && `, ${formatDate(d.product.searchedAt)} 조회`}
            </small>
          </span>
        </div>
      ) : d.search?.status === 'FAILED' ? (
        <Notice kind="warn">제품 검색에 실패해 직접 입력한 정보로 등록했어요.</Notice>
      ) : d.search && d.search.candidates.length === 0 ? (
        <Notice kind="info">검색 결과 없음: 택 정보와 직접 입력한 값으로 등록했어요.</Notice>
      ) : (
        <div className="plain-list" aria-label="제품 후보">
          <p className="hint cand-hint">찾은 제품 후보 {d.search!.candidates.length}개 중 선택하지 않았어요.</p>
          {d.search!.candidates.map((c) => (
            <a key={c.id} className="row-link" href={c.sourceUrl} target="_blank" rel="noreferrer noopener" data-testid="product-candidate">
              <span className="mini-tile">{c.imageUrl ? <img src={c.imageUrl} alt="" referrerPolicy="no-referrer" /> : <Icon name="image" size={20} />}</span>
              <span className="row-main"><b>{c.name}</b>{c.matchReason && <small>{c.matchReason}</small>}</span>
              <Icon name="chevronRight" size={18} />
            </a>
          ))}
        </div>
      )}
    </section>
  )
}

/** 사용자가 정하는 집 안 상태(세탁·수선 중은 맡기기·회수로만 바뀐다). */
const HOME_STATUSES = [['STORED', '보관 중'], ['PENDING', '착용·보관 전'], ['WASH_WAITING', '세탁 대기']] as const

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
    <Sheet title="정보 수정" onClose={onClose}
      footer={<button type="submit" form="garment-edit" className="btn btn-primary btn-block" disabled={busy}>{busy && <Spinner />}저장</button>}>
      <form id="garment-edit" onSubmit={save} className="fields" noValidate>
        <GarmentForm value={value} onChange={setValue} />
        <div className="field home-status">
          <span id="home-status">집 안 상태</span>
          <div className="chips" role="radiogroup" aria-labelledby="home-status">
            {HOME_STATUSES.map(([v, l]) => (
              <button key={v} type="button" className="chip" role="radio" aria-checked={homeStatus === v} data-on={homeStatus === v}
                disabled={away} onClick={() => setHomeStatus(v)}>{l}</button>
            ))}
          </div>
          {away && <small>세탁·수선 중에는 관리함에서 회수 완료를 먼저 눌러 주세요.</small>}
        </div>
        {error && <Notice>{error}</Notice>}
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

  const chip = (on: boolean, text: string, pick: () => void) => (
    <button type="button" className="chip" data-on={on} aria-pressed={on} onClick={pick}>{text}</button>
  )

  return (
    <Sheet title="세탁·수선 맡기기" onClose={onClose}
      footer={<button type="submit" form="care-form" className="btn btn-primary btn-block" disabled={busy}>{busy && <Spinner />}기록하기</button>}>
      <form id="care-form" onSubmit={save} className="fields" noValidate>
        <div className="field">
          <span id="care-type">종류</span>
          <div className="chips" role="group" aria-labelledby="care-type">
            {chip(careType === 'WASH', '세탁', () => setCareType('WASH'))}
            {chip(careType === 'REPAIR', '수선', () => setCareType('REPAIR'))}
          </div>
        </div>
        <div className="field">
          <span id="care-place">맡긴 곳</span>
          <div className="chips" role="group" aria-labelledby="care-place">
            {chip(place === 'SHOP', '업체', () => setPlace('SHOP'))}
            {chip(place === 'HOME', '자택', () => setPlace('HOME'))}
          </div>
        </div>
        {place === 'SHOP' && (
          <label className="field">
            <span>업체명</span>
            <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="예: 동네 세탁소" />
          </label>
        )}
        <label className="field">
          <span>내용</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={careType === 'WASH' ? '예: 드라이클리닝' : '예: 밑단 3cm 줄임'} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>맡긴 날짜</span>
            <input type="date" value={droppedOn} max={iso(today)} onChange={(e) => setDroppedOn(e.target.value)} />
          </label>
          <label className="field">
            <span>회수 예정일</span>
            <input type="date" value={dueOn} min={droppedOn} onChange={(e) => setDueOn(e.target.value)} />
          </label>
        </div>
        {error && <Notice>{error}</Notice>}
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
    <Sheet title="위치 변경" onClose={onClose}
      footer={<button type="button" className="btn btn-primary btn-block" disabled={!pick || busy} onClick={() => pick && onPick(pick)}>{busy && <Spinner />}여기로 옮김</button>}>
      <p className="sheet-text sheet-lead">실제로 옷을 옮겨 넣은 뒤 눌러 주세요. 누른 시점부터 이 위치로 보여요.</p>
      {error && <Notice>{error}</Notice>}
      {!map && !error && <Loading />}
      {map && leaves.length === 0 && (
        <div className="empty sheet-empty">
          <p>아직 수납 공간이 없어요. 옷장 지도에서 공간을 먼저 만들어 주세요.</p>
          <Link className="btn btn-primary" to="/map">옷장 지도</Link>
        </div>
      )}
      {map && <SpaceList all={map.spaces} options={leaves} pick={pick} current={current} label="옮길 공간" onPick={setPick} />}
    </Sheet>
  )
}
