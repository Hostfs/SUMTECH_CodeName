import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api'
import GarmentArt from '../components/GarmentArt'
import GarmentForm from '../components/GarmentForm'
import { Icon, type IconName } from '../components/Icon'
import { Notice, Sheet, Spinner } from '../components/Ui'
import { cleanupImage, processCoverIfNeeded } from '../imageCleanup'
import { emptyForm, toInput, type GarmentFormValue } from '../garmentForm'
import { COLOR_PALETTE } from '../colors'
import type { Candidate, Extraction, GarmentDetail, MapView, SpaceView } from '../types'
import '../styles/register.app.css'

type Suggestion = Partial<Omit<GarmentFormValue, 'materials' | 'careLines' | 'collections' | 'totalLengthCm' | 'otherMeasurements'>> & {
  materials?: { part: string; fiber: string; percent: number }[]
  careLines?: string[]
}
type AnalyzeResult = { extraction: Extraction; suggestion: Suggestion; aiFields: string[]; unread: string[] }
type SearchResult = { id: number; status: 'SUCCEEDED' | 'FAILED'; candidates: Candidate[]; message: string | null }

const MAX_PHOTOS = 4

// 등록 방법. 어떤 구역을 보여 줄지만 바꾼다(저장 흐름은 같다). 모양은 초안의 등록 방법 카드(.method): 주 방법 둘 + 넓은 줄 하나.
type Method = 'tag' | 'photo' | 'manual'
const METHODS: { value: Method; title: string; sub: string; icon: IconName; main?: boolean; wide?: boolean }[] = [
  { value: 'tag', title: '택 사진으로', sub: '브랜드·소재·세탁법을 AI가 읽어요', icon: 'tag', main: true },
  { value: 'photo', title: '사진 한 장으로', sub: '옷 사진을 찍고 정보는 직접', icon: 'camera', main: true },
  { value: 'manual', title: '직접 입력', sub: '사진 없이 이름·종류만', icon: 'edit', wide: true },
]

// AI가 채운 항목 코드 → 입력 칸. 저장 전에 사용자가 고친 칸은 'AI가 채운 항목'에서 뺀다.
const FIELD_KEYS: Record<string, keyof GarmentFormValue> = {
  NAME: 'name', BRAND: 'brand', PRODUCT_CODE: 'productCode', COLOR: 'colorName', SIZE_LABEL: 'sizeLabel', ORIGIN: 'origin',
  SUB_TYPE: 'subType', SEASONS: 'seasons', MATERIAL: 'materials', CARE: 'careLines',
}

function usePreviews(files: File[]) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  return urls
}

// 넓은 PC에서는 택·사진·제품 찾기·보관 위치를 왼쪽 단, 옷 정보를 오른쪽 단에 둔다(register.app.css의 두 단 기준과 같은 값).
const WIDE = '(min-width: 1100px)'
function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
function useWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches)
}

/** 사진 칸(초안 .photo-row): 올린 사진과 '추가' 칸. 추가 칸은 파일 입력을 감싼 label이라 누르면 사진을 고른다. */
function PhotoTiles({ kind, urls, onAdd, onRemove, locked, busy, cover, multiple, capture }: {
  kind: '택 사진' | '옷 사진'
  urls: string[]
  onAdd: (e: ChangeEvent<HTMLInputElement>) => void
  onRemove: (i: number) => void
  locked?: boolean
  busy?: boolean
  cover?: boolean
  multiple?: boolean
  capture?: 'environment'
}) {
  return (
    <div className="photo-row reg-photos" data-busy={busy || undefined}>
      {urls.map((u, i) => (
        <div className="photo" key={u}>
          <img src={u} alt={`${kind} ${i + 1}`} />
          {cover && i === 0 && <span className="badge reg-cover">대표</span>}
          {!locked && (
            <button type="button" className="photo-x" aria-label={`${kind} ${i + 1} 빼기`} onClick={() => onRemove(i)}>
              <Icon name="close" size={14} stroke={2.4} />
            </button>
          )}
        </div>
      ))}
      {!locked && urls.length < MAX_PHOTOS && (
        <label className="photo add">
          <Icon name="camera" size={22} />
          <span>{kind}</span>
          <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} capture={capture}
            aria-label={`${kind} 추가`} onChange={onAdd} />
        </label>
      )}
    </div>
  )
}

/**
 * 대표 이미지 미리보기(초안 누끼 카드 .cut-card). 저장하면 서버가 첫 옷 사진을, 없으면 고른 제품 이미지를 대표로 삼고
 * 저장 직후 같은 정리(imageCleanup)를 거치므로, 옷 사진은 미리 정리해 배경을 지운 모습을 보여 준다. 정리하지 못하면 원본을 쓴다고 알린다.
 */
function CoverPreview({ photo, photoUrl, productUrl }: { photo: File | null; photoUrl: string | null; productUrl: string | null }) {
  const [cut, setCut] = useState<{ file: File; url?: string; error?: string } | null>(null)
  useEffect(() => {
    if (!photo) return
    let alive = true
    let url = ''
    cleanupImage(photo)
      .then((blob) => {
        if (!alive) return
        url = URL.createObjectURL(blob)
        setCut({ file: photo, url })
      })
      .catch((e) => alive && setCut({ file: photo, error: errorMessage(e) }))
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [photo])
  const result = photo && cut?.file === photo ? cut : null

  if (photo) {
    return (
      <div className="cut-card reg-cover-card">
        <div className="checker">
          {!result ? <span className="reg-cover-busy"><i className="spin" />배경을 지우는 중</span>
            : <img src={result.url ?? photoUrl ?? ''} alt="대표 이미지 미리보기" />}
        </div>
        {result && (
          <div className="cut-meta">
            {result.error ? <span className="tag muted"><Icon name="alert" size={13} stroke={2.4} />원본을 그대로 써요</span>
              : <span className="tag"><Icon name="check" size={13} stroke={2.6} />배경을 지웠어요</span>}
          </div>
        )}
        {result?.error && <p className="hint">{result.error}</p>}
      </div>
    )
  }
  if (!productUrl) return null
  return (
    <div className="cut-card reg-cover-card">
      <div className="checker"><img src={productUrl} alt="대표 이미지 미리보기" referrerPolicy="no-referrer" /></div>
      <div className="cut-meta">
        <span className="tag"><Icon name="check" size={13} stroke={2.6} />고른 제품 이미지를 써요</span>
      </div>
    </div>
  )
}

/** 보관 위치 고르기(초안 위치 시트): 맨 아래 공간만 고를 수 있고, 상위 공간 이름 아래에 들여 써서 묶는다. */
function SpaceSheet({ spaces, current, onClose, onPick }: { spaces: SpaceView[]; current: string; onClose: () => void; onPick: (id: string) => void }) {
  const [picked, setPicked] = useState(current)
  const leaves = spaces.filter((s) => !spaces.some((o) => o.parentId === s.id))
  const groups = new Map<number | null, SpaceView[]>()
  leaves.forEach((s) => groups.set(s.parentId, [...(groups.get(s.parentId) ?? []), s]))

  const row = (id: string, label: string, extra?: string, indent?: boolean) => (
    <button key={id || 'none'} type="button" className={`loc-row${indent ? ' indent' : ''}`} role="radio" aria-checked={picked === id} data-on={picked === id}
      onClick={() => setPicked(id)}>
      <span className="radio">{picked === id && <Icon name="check" size={13} stroke={3} />}</span>
      {label}
      {extra && <em>{extra}</em>}
    </button>
  )
  const capacity = (s: SpaceView) => (s.capacity ? `${s.count}/${s.capacity}벌` : undefined)

  return (
    <Sheet title="보관 위치" onClose={onClose}
      footer={<button type="button" className="btn btn-primary btn-block" onClick={() => onPick(picked)}>{picked ? '이 위치로 정하기' : '나중에 정하기'}</button>}>
      <div className="loc-list" role="radiogroup" aria-label="넣어 둘 공간">
        {row('', '나중에 정하기(미배치)')}
        {[...groups].map(([parentId, list]) => (parentId === null
          ? list.map((s) => row(String(s.id), s.name, capacity(s)))
          : (
            <div key={parentId} className="loc-group">
              <p className="loc-space"><Icon name="box" size={15} />{spaces.find((o) => o.id === parentId)?.path}</p>
              {list.map((s) => row(String(s.id), s.name, capacity(s), true))}
            </div>
          )))}
      </div>
    </Sheet>
  )
}

/** 옷 등록: 택 사진 → AI 판독·확인 → 제품 찾기(선택) → 저장. 어느 단계가 실패해도 직접 입력으로 끝낼 수 있다. */
export default function Register() {
  const navigate = useNavigate()
  const wide = useWide()
  const [tagFiles, setTagFiles] = useState<File[]>([])
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const tagUrls = usePreviews(tagFiles)
  const photoUrls = usePreviews(photoFiles)

  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null)
  const [analyzeError, setAnalyzeError] = useState('')
  const [manual, setManual] = useState(false)
  const [method, setMethod] = useState<Method>('tag')
  // 분석 직후의 입력값(사용자가 고쳤는지 비교용)
  const [suggested, setSuggested] = useState<GarmentFormValue | null>(null)

  const [form, setForm] = useState<GarmentFormValue>(emptyForm)
  const [searching, setSearching] = useState(false)
  const [search, setSearch] = useState<SearchResult | null>(null)
  const [searchError, setSearchError] = useState('')
  const [candidateId, setCandidateId] = useState<number | null>(null)

  // 공간 전체(상위 공간 이름으로 묶어 보여 주려고 모두 둔다). 고를 수 있는 곳은 맨 아래 공간뿐이다.
  const [spaces, setSpaces] = useState<SpaceView[]>([])
  const [spaceId, setSpaceId] = useState('')
  const [spaceSheet, setSpaceSheet] = useState(false)
  // 시트는 닫기 함수가 바뀔 때마다 다시 준비하므로 같은 함수를 넘긴다.
  const closeSpaceSheet = useCallback(() => setSpaceSheet(false), [])
  useEffect(() => {
    api.get<MapView>('/api/spaces')
      .then((m) => setSpaces(m.spaces))
      .catch(() => undefined)
  }, [])
  const leaves = spaces.filter((s) => !spaces.some((o) => o.parentId === s.id))
  const pickedSpace = leaves.find((s) => String(s.id) === spaceId)

  const [saving, setSaving] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [saveError, setSaveError] = useState('')

  // 분석이 끝난 뒤에만 택 사진을 잠근다. 실패하면 사진을 바꾸거나 '택 분석하기'로 다시 시도할 수 있다.
  const analyzed = analysis?.extraction.status === 'DONE'
  const showForm = Boolean(analysis) || manual || method !== 'tag'
  const showTag = method === 'tag' || Boolean(analysis)

  // 칸 이름 옆 표시: 택에서 읽은 값(고치면 '직접 고침'으로 바뀌고 저장 때 AI가 채운 항목에서 빠진다), 읽지 못한 값
  const flags = useMemo(() => {
    const f: Record<string, 'ai' | 'edited' | 'check'> = {}
    analysis?.aiFields.forEach((k) => {
      const key = FIELD_KEYS[k]
      f[k] = key && suggested && JSON.stringify(form[key]) !== JSON.stringify(suggested[key]) ? 'edited' : 'ai'
    })
    analysis?.unread.forEach((k) => (f[k] = 'check'))
    return f
  }, [analysis, form, suggested])

  function addFiles(e: ChangeEvent<HTMLInputElement>, which: 'tag' | 'photo') {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    const setter = which === 'tag' ? setTagFiles : setPhotoFiles
    setter((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS))
  }

  async function analyze() {
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const body = new FormData()
      tagFiles.forEach((f) => body.append('files', f))
      const result = await api.post<AnalyzeResult>('/api/labels/analyze', body)
      setAnalysis(result)
      const s = result.suggestion
      const next: GarmentFormValue = {
        ...form,
        name: s.name ?? form.name,
        subType: s.subType ?? form.subType,
        brand: s.brand ?? form.brand,
        productCode: s.productCode ?? form.productCode,
        colorName: s.colorName ?? form.colorName,
        // 택에는 색 이름만 적혀 있으므로 같은 이름의 팔레트 색이 있으면 그 색을 고른다.
        colorHex: (s.colorName && COLOR_PALETTE.find((p) => p.name === s.colorName)?.hex) || form.colorHex,
        sizeLabel: s.sizeLabel ?? form.sizeLabel,
        origin: s.origin ?? form.origin,
        seasons: s.seasons?.length ? s.seasons : form.seasons,
        materials: s.materials?.length ? s.materials.map((m) => ({ part: m.part, fiber: m.fiber, percent: String(m.percent) })) : form.materials,
        careLines: s.careLines?.length ? s.careLines.join('\n') : form.careLines,
      }
      setForm(next)
      setSuggested(next)
      if (result.extraction.status === 'FAILED') {
        // 사진은 그대로 두고 다시 분석하거나 직접 입력할 수 있게 한다.
        setAnalyzeError(result.extraction.errorMessage ?? '택을 읽지 못했어요.')
        setManual(true)
      }
    } catch (e) {
      // 분석이 실패해도 입력 칸을 열어 직접 입력으로 등록을 마칠 수 있게 한다.
      setAnalyzeError(errorMessage(e))
      setManual(true)
    } finally {
      setAnalyzing(false)
    }
  }

  async function findProduct() {
    setSearching(true)
    setSearchError('')
    setCandidateId(null)
    try {
      const result = await api.post<SearchResult>('/api/products/search', {
        extractionId: analysis?.extraction.id ?? null, brand: form.brand, productCode: form.productCode, name: form.name,
      })
      setSearch(result)
    } catch (e) {
      setSearchError(errorMessage(e))
    } finally {
      setSearching(false)
    }
  }

  async function save() {
    setSaving(true)
    setSaveError('')
    try {
      const imageIds: number[] = []
      for (const f of photoFiles) {
        const body = new FormData()
        body.append('file', f)
        const up = await api.post<{ id: number }>('/api/images', body)
        imageIds.push(up.id)
      }
      const aiFields = analysis && suggested
        ? analysis.aiFields.filter((k) => !analysis.unread.includes(k)
          && (!FIELD_KEYS[k] || JSON.stringify(form[FIELD_KEYS[k]]) === JSON.stringify(suggested[FIELD_KEYS[k]])))
        : []
      const created = await api.post<GarmentDetail>('/api/garments', {
        ...toInput(form), imageIds, extractionId: analysis?.extraction.id ?? null, candidateId, aiFields,
        spaceId: spaceId ? Number(spaceId) : null,
      })
      // 옷은 이미 저장됐으므로 대표 이미지 정리가 실패해도 상세 화면으로 간다(상세에서 '다시 처리' 가능).
      setCleaning(true)
      await processCoverIfNeeded(created).catch(() => undefined)
      navigate(`/closet/${created.summary.id}`, { replace: true })
    } catch (e) {
      setSaveError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // 뒤로: 앱 안에서 들어왔으면 이전 화면, 주소로 바로 열었으면 내 옷장
  function back() {
    if ((window.history.state as { idx?: number } | null)?.idx) navigate(-1)
    else navigate('/closet')
  }

  const canSave = form.name.trim() !== '' && form.subType !== ''
  // 사진 구역은 '사진 한 장으로'일 때 등록 방법 바로 아래(주 입력)에 둔다.
  const photoFirst = method === 'photo'
  // PC는 왼쪽 단에 자료(택·사진·제품 찾기·보관 위치)를 카드(.panel)로, 오른쪽 단에 옷 정보와 저장을 둔다.
  // 휴대폰은 초안처럼 한 줄로: 옷 정보 → 제품 찾기 → 옷 사진 → 보관 위치 → 저장.
  const box = (asPanel: boolean) => (asPanel ? 'panel reg-panel' : 'reg-block')
  const candidates = search?.candidates ?? []
  const pickedProduct = candidates.find((c) => c.id === candidateId)

  const photoSection = (
    <section className={box(photoFirst || wide)} aria-label="옷 사진">
      <h3 className="reg-title">옷 사진 <small>{photoFirst ? '대표 이미지' : '선택'}</small></h3>
      <p className="hint">{photoFirst ? '한 장이면 충분해요. 목록 카드의 대표 이미지가 돼요.' : '목록 카드의 대표 이미지가 돼요.'}</p>
      <CoverPreview photo={photoFiles[0] ?? null} photoUrl={photoUrls[0] ?? null} productUrl={pickedProduct?.imageUrl ?? null} />
      <PhotoTiles kind="옷 사진" urls={photoUrls} cover onAdd={(e) => addFiles(e, 'photo')} onRemove={(i) => setPhotoFiles(photoFiles.filter((_, j) => j !== i))} />
      <p className="fine">배경을 지우고 가운데 맞춰 정리해요. 원본도 남아요. 없으면 고른 제품 이미지나 종류·색으로 그린 그림을 써요.</p>
    </section>
  )

  const tagSection = (
    <section className="panel reg-panel" aria-label="택 사진">
      <h3 className="reg-title">택 사진 <small>최대 {MAX_PHOTOS}장</small></h3>
      <p className="hint">세탁·혼용률 택과 브랜드·품번 택을 찍거나 골라요(JPG·PNG·WEBP, 장당 10MB).</p>
      <PhotoTiles kind="택 사진" urls={tagUrls} locked={analyzed} busy={analyzing} multiple capture="environment"
        onAdd={(e) => addFiles(e, 'tag')} onRemove={(i) => setTagFiles(tagFiles.filter((_, j) => j !== i))} />
      {!analyzed && (
        <div className="reg-panel-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={analyze} disabled={tagFiles.length === 0 || analyzing} aria-busy={analyzing}>
            {analyzing ? <Spinner /> : <Icon name="sparkle" size={16} />}{analyzing ? '택을 읽는 중' : '택 분석하기'}
          </button>
          {!manual && <button type="button" className="link-btn muted" onClick={() => setManual(true)}>택 없이 직접 입력</button>}
        </div>
      )}
      {analyzeError && (
        <>
          <Notice kind="warn">{analyzeError} 사진을 다시 찍거나, 아래에 직접 입력해 등록을 마칠 수 있어요.</Notice>
          {!analyzed && !manual && <button type="button" className="link-btn" onClick={() => setManual(true)}>직접 입력으로 계속</button>}
        </>
      )}
      {analysis && analysis.extraction.status === 'DONE' && (
        <>
          <Notice kind="ok">택을 읽었어요. 노란 표시가 있는 칸은 읽지 못했으니 확인해 주세요.</Notice>
          {analysis.extraction.values.length > 0 && (
            <div className="season-tags reg-read">
              {analysis.extraction.values.map((v) => (
                <span key={v.field} className={`tag${v.unread ? ' muted' : ''}`}>
                  <Icon name={v.unread ? 'alert' : 'check'} size={13} stroke={2.6} />{v.fieldLabel}
                </span>
              ))}
            </div>
          )}
          {analysis.extraction.rawText && (
            <details className="reg-raw">
              <summary><Icon name="chevronRight" size={16} />택 원문 보기</summary>
              <div className="reg-raw-text">{analysis.extraction.rawText}</div>
            </details>
          )}
        </>
      )}
    </section>
  )

  const searchSection = (
    <section className={box(wide)} aria-label="제품 찾기">
      <h3 className="reg-title">제품 찾기 <small>선택</small></h3>
      <p className="hint">브랜드와 품번으로 웹에서 같은 제품을 찾아요.</p>
      <button type="button" className="btn btn-outline btn-block" onClick={findProduct} aria-busy={searching}
        disabled={searching || (!form.brand.trim() && !form.productCode.trim() && !form.name.trim())}>
        {searching ? <Spinner /> : <Icon name="search" size={16} />}{searching ? '찾는 중' : '제품 찾기'}
      </button>
      {searchError && <Notice kind="warn">{searchError} 제품을 고르지 않아도 저장할 수 있어요.</Notice>}
      {search && search.status === 'FAILED' && (
        <Notice kind="warn">검색에 실패했어요{search.message ? `: ${search.message}` : ''}. 직접 입력한 정보로 저장할 수 있어요.</Notice>
      )}
      {search && search.status === 'SUCCEEDED' && candidates.length === 0 && (
        <Notice kind="info">검색 결과 없음. 택 정보와 직접 입력한 값으로 저장할 수 있어요.</Notice>
      )}
      {candidates.length > 0 && (
        <div className="reg-cands" role="group" aria-label="제품 후보">
          <p className="hint">실제로 가진 제품과 색상이 같은 후보를 고르세요. 맞는 후보가 없으면 고르지 않고 저장해요.</p>
          <ul className="hits">
            {candidates.map((c) => (
              <li key={c.id}>
                <button type="button" aria-pressed={candidateId === c.id} data-testid="product-candidate"
                  onClick={() => setCandidateId(candidateId === c.id ? null : c.id)}>
                  <span className="hit-img">{c.imageUrl ? <img src={c.imageUrl} alt="" referrerPolicy="no-referrer" /> : '사진 없음'}</span>
                  <span className="hit-text">
                    <b>{c.name}</b>
                    <small>{[c.brand, c.colorName].filter(Boolean).join(', ')}</small>
                    {c.matchReason && <small>{c.matchReason}</small>}
                  </span>
                  <span className="radio">{candidateId === c.id && <Icon name="check" size={13} stroke={3} />}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )

  const spaceSection = (
    <section className={box(wide)} aria-label="보관 위치">
      <h3 className="reg-title">보관 위치 <small>선택</small></h3>
      {leaves.length > 0 ? (
        <>
          <p className="hint">넣어 둘 곳을 바로 정해요. 나중에 옷장 지도에서 정해도 돼요.</p>
          <button type="button" className="loc-pick" aria-haspopup="dialog" onClick={() => setSpaceSheet(true)}>
            <Icon name="pin" size={18} />
            <span>{pickedSpace ? pickedSpace.path : '보관 위치는 나중에 정할게요'}</span>
            <Icon name="chevronRight" size={18} />
          </button>
        </>
      ) : (
        <p className="hint">아직 수납 공간이 없어요. 저장한 뒤 옷장 지도에서 공간을 만들고 넣을 수 있어요.</p>
      )}
    </section>
  )

  return (
    <div className="page pinned register reg-page">
      <div className="pin">
        <header className="topbar">
          <button type="button" className="icon-btn" onClick={back} aria-label="뒤로"><Icon name="chevronLeft" size={24} /></button>
          <h1>옷 등록</h1>
          <span className="topbar-gap" />
        </header>
      </div>

      <div className="reg-cols">
        <div className="reg-side">
          <div className="reg-intro">
            <h2>어떻게 등록할까요?</h2>
            <p>택을 찍으면 브랜드·소재·세탁법을 읽어 와요. 읽은 값은 저장 전에 확인하고 고칠 수 있어요.</p>
          </div>

          <div className="methods" role="radiogroup" aria-label="등록 방법">
            {METHODS.map((m) => (
              <button key={m.value} type="button" role="radio" aria-checked={method === m.value} className="method"
                data-main={m.main} data-wide={m.wide} data-on={method === m.value} onClick={() => setMethod(m.value)}>
                <span className="method-ico"><Icon name={m.icon} size={22} /></span>
                <b>{m.title}</b>
                <small>{m.sub}</small>
              </button>
            ))}
          </div>

          {photoFirst && photoSection}
          {showTag && tagSection}
          {wide && showForm && (
            <>
              {!photoFirst && photoSection}
              {searchSection}
              {spaceSection}
            </>
          )}
        </div>

        <div className="reg-main">
          {showForm ? (
            <>
              <section className="reg-block reg-info" aria-label="옷 정보">
                <h3 className="reg-title">옷 정보</h3>
                <GarmentForm value={form} onChange={setForm} flags={flags} />
              </section>

              {!wide && (
                <>
                  {searchSection}
                  {!photoFirst && photoSection}
                  {spaceSection}
                </>
              )}

              <div className="action-bar single reg-save">
                {saveError && <Notice>{saveError}</Notice>}
                {!canSave && <p className="fine">옷 이름과 옷 종류를 채우면 저장할 수 있어요.</p>}
                <button type="button" className="btn btn-primary btn-block" onClick={save} disabled={!canSave || saving} aria-busy={saving}>
                  {saving && <Spinner />}{cleaning ? '대표 이미지 정리 중' : '저장하기'}
                </button>
              </div>
            </>
          ) : wide ? (
            // PC: 택을 읽기 전에는 오른쪽 단에 무엇이 채워질지 미리 보여 준다(초안 자리표시 .stub).
            <div className="stub reg-wait">
              <div className="stub-art">
                {['SHIRT', 'KNIT', 'PANTS'].map((s) => <GarmentArt key={s} subType={s} colorHex="#D8D2C6" size={64} />)}
              </div>
              <h2>택을 읽으면 여기에 채워져요</h2>
              <p>이름·종류·브랜드·소재·세탁법을 택에서 읽어 옷 정보 칸을 채워요. 저장하기 전에 확인하고 고칠 수 있어요.</p>
            </div>
          ) : null}
        </div>
      </div>

      {spaceSheet && <SpaceSheet spaces={spaces} current={spaceId} onClose={closeSpaceSheet} onPick={(id) => { setSpaceId(id); setSpaceSheet(false) }} />}
    </div>
  )
}
