import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api'
import GarmentForm from '../components/GarmentForm'
import { processCoverIfNeeded } from '../imageCleanup'
import { emptyForm, toInput, type GarmentFormValue } from '../garmentForm'
import { IconCamera, IconClose, IconSearch, IconSparkle } from '../components/Icons'
import { Notice, Spinner } from '../components/Ui'
import type { Candidate, Extraction, GarmentDetail } from '../types'

type Suggestion = Partial<Omit<GarmentFormValue, 'materials' | 'careLines' | 'collections' | 'totalLengthCm' | 'otherMeasurements'>> & {
  materials?: { part: string; fiber: string; percent: number }[]
  careLines?: string[]
}
type AnalyzeResult = { extraction: Extraction; suggestion: Suggestion; aiFields: string[]; unread: string[] }
type SearchResult = { id: number; status: 'SUCCEEDED' | 'FAILED'; candidates: Candidate[]; message: string | null }

const MAX_PHOTOS = 4

function usePreviews(files: File[]) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  return urls
}

/** 옷 등록: 택 사진 → AI 판독·확인 → 제품 찾기(선택) → 저장. 어느 단계가 실패해도 직접 입력으로 끝낼 수 있다. */
export default function Register() {
  const navigate = useNavigate()
  const [tagFiles, setTagFiles] = useState<File[]>([])
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const tagUrls = usePreviews(tagFiles)
  const photoUrls = usePreviews(photoFiles)

  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null)
  const [analyzeError, setAnalyzeError] = useState('')
  const [manual, setManual] = useState(false)

  const [form, setForm] = useState<GarmentFormValue>(emptyForm)
  const [searching, setSearching] = useState(false)
  const [search, setSearch] = useState<SearchResult | null>(null)
  const [searchError, setSearchError] = useState('')
  const [candidateId, setCandidateId] = useState<number | null>(null)

  const [saving, setSaving] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [saveError, setSaveError] = useState('')

  const step = !analysis && !manual ? 1 : !search ? 2 : 3
  const showForm = Boolean(analysis) || manual

  const flags = useMemo(() => {
    const f: Record<string, 'ai' | 'check'> = {}
    analysis?.aiFields.forEach((k) => (f[k] = 'ai'))
    analysis?.unread.forEach((k) => (f[k] = 'check'))
    return f
  }, [analysis])

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
      setForm((prev) => ({
        ...prev,
        name: s.name ?? prev.name,
        subType: s.subType ?? prev.subType,
        brand: s.brand ?? prev.brand,
        productCode: s.productCode ?? prev.productCode,
        colorName: s.colorName ?? prev.colorName,
        colorHex: s.colorHex ?? prev.colorHex,
        sizeLabel: s.sizeLabel ?? prev.sizeLabel,
        origin: s.origin ?? prev.origin,
        seasons: s.seasons?.length ? s.seasons : prev.seasons,
        materials: s.materials?.length ? s.materials.map((m) => ({ part: m.part, fiber: m.fiber, percent: String(m.percent) })) : prev.materials,
        careLines: s.careLines?.length ? s.careLines.join('\n') : prev.careLines,
      }))
      if (result.extraction.status === 'FAILED') setAnalyzeError(result.extraction.errorMessage ?? '택을 읽지 못했어요.')
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
      const aiFields = analysis ? analysis.aiFields.filter((k) => !analysis.unread.includes(k)) : []
      const created = await api.post<GarmentDetail>('/api/garments', {
        ...toInput(form), imageIds, extractionId: analysis?.extraction.id ?? null, candidateId, aiFields,
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

  const canSave = form.name.trim() !== '' && form.subType !== ''

  return (
    <>
      <div className="page-head"><h1 className="page-title">옷 등록</h1></div>
      <p className="page-lead">택을 찍으면 브랜드·소재·세탁법을 읽어 와요. 읽은 값은 저장 전에 확인하고 고칠 수 있어요.</p>
      <div className="steps" aria-hidden><span className="on" /><span className={step >= 2 ? 'on' : ''} /><span className={step >= 3 ? 'on' : ''} /></div>

      <section className="card" aria-label="택 사진">
        <h2 className="section-title">택 사진 <small>세탁·혼용률 택과 브랜드·품번 택, 최대 {MAX_PHOTOS}장</small></h2>
        <label className="upload">
          <IconCamera />
          <strong>택 사진 추가</strong>
          <span className="field-hint">카메라로 찍거나 사진을 골라요(JPG·PNG·WEBP, 장당 10MB)</span>
          <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment"
            aria-label="택 사진 추가" onChange={(e) => addFiles(e, 'tag')} disabled={tagFiles.length >= MAX_PHOTOS || Boolean(analysis)} />
        </label>
        {tagFiles.length > 0 && (
          <div className="photo-row">
            {tagUrls.map((u, i) => (
              <div className="photo" key={u}>
                <img src={u} alt={`택 사진 ${i + 1}`} />
                {!analysis && <button type="button" aria-label={`택 사진 ${i + 1} 빼기`} onClick={() => setTagFiles(tagFiles.filter((_, j) => j !== i))}><IconClose /></button>}
              </div>
            ))}
          </div>
        )}
        {!analysis && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <button type="button" className="btn" onClick={analyze} disabled={tagFiles.length === 0 || analyzing}>
              {analyzing ? <Spinner /> : <IconSparkle />}{analyzing ? '택을 읽는 중' : '택 분석하기'}
            </button>
            {!manual && <button type="button" className="btn btn-ghost" onClick={() => setManual(true)}>택 없이 직접 입력</button>}
          </div>
        )}
        {analyzeError && (
          <div style={{ marginTop: 12 }}>
            <Notice kind="warn">{analyzeError} 사진을 다시 찍거나, 아래에 직접 입력해 등록을 마칠 수 있어요.</Notice>
            {!analysis && <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 8 }} onClick={() => setManual(true)}>직접 입력으로 계속</button>}
          </div>
        )}
        {analysis && analysis.extraction.status === 'DONE' && (
          <div style={{ marginTop: 16 }}>
            <Notice kind="ok">택을 읽었어요. 노란 표시가 있는 칸은 읽지 못했으니 확인해 주세요.</Notice>
            {analysis.extraction.rawText && (
              <details style={{ marginTop: 10 }}>
                <summary className="field-hint" style={{ cursor: 'pointer' }}>택 원문 보기</summary>
                <div className="raw-text" style={{ marginTop: 8 }}>{analysis.extraction.rawText}</div>
              </details>
            )}
          </div>
        )}
      </section>

      {showForm && (
        <section className="card" aria-label="옷 정보" style={{ marginTop: 16 }}>
          <h2 className="section-title">옷 정보</h2>
          <div className="form-grid">
            <GarmentForm value={form} onChange={setForm} flags={flags} />
          </div>
        </section>
      )}

      {showForm && (
        <section className="card" aria-label="제품 찾기" style={{ marginTop: 16 }}>
          <h2 className="section-title">제품 찾기 <small>브랜드와 품번으로 웹에서 찾아요</small></h2>
          <button type="button" className="btn btn-outline" onClick={findProduct} disabled={searching || (!form.brand.trim() && !form.productCode.trim() && !form.name.trim())}>
            {searching ? <Spinner /> : <IconSearch />}{searching ? '찾는 중' : '제품 찾기'}
          </button>
          {searchError && <div style={{ marginTop: 12 }}><Notice kind="warn">{searchError} 제품을 고르지 않아도 저장할 수 있어요.</Notice></div>}
          {search && search.status === 'FAILED' && (
            <div style={{ marginTop: 12 }}><Notice kind="warn">검색에 실패했어요{search.message ? `: ${search.message}` : ''}. 직접 입력한 정보로 저장할 수 있어요.</Notice></div>
          )}
          {search && search.status === 'SUCCEEDED' && search.candidates.length === 0 && (
            <div style={{ marginTop: 12 }}><Notice kind="info">검색 결과 없음. 택 정보와 직접 입력한 값으로 저장할 수 있어요.</Notice></div>
          )}
          {search && search.candidates.length > 0 && (
            <div className="cand-list" style={{ marginTop: 14 }} role="group" aria-label="제품 후보">
              <p className="field-hint" style={{ margin: 0 }}>실제로 가진 제품과 색상이 같은 후보를 고르세요. 맞는 후보가 없으면 고르지 않고 저장해요.</p>
              {search.candidates.map((c) => (
                <button key={c.id} type="button" className="cand" aria-pressed={candidateId === c.id} data-testid="product-candidate"
                  onClick={() => setCandidateId(candidateId === c.id ? null : c.id)}>
                  <span className="cand-img">{c.imageUrl ? <img src={c.imageUrl} alt="" referrerPolicy="no-referrer" /> : '사진 없음'}</span>
                  <span>
                    <span className="cand-name">{c.name}</span><br />
                    <span className="cand-meta">{[c.brand, c.colorName].filter(Boolean).join(', ')}</span><br />
                    <span className="cand-meta">{c.matchReason}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {showForm && (
        <section className="card" aria-label="옷 사진" style={{ marginTop: 16 }}>
          <h2 className="section-title">옷 사진 <small>선택, 목록 카드의 대표 이미지가 돼요</small></h2>
          <label className="upload">
            <IconCamera />
            <strong>옷 사진 추가</strong>
            <span className="field-hint">배경을 지우고 가운데 맞춰 정리해요. 원본도 남아요. 없으면 고른 제품 이미지나 종류·색으로 그린 그림을 써요</span>
            <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="옷 사진 추가" onChange={(e) => addFiles(e, 'photo')} disabled={photoFiles.length >= MAX_PHOTOS} />
          </label>
          {photoFiles.length > 0 && (
            <div className="photo-row">
              {photoUrls.map((u, i) => (
                <div className="photo" key={u}>
                  <img src={u} alt={`옷 사진 ${i + 1}`} />
                  <button type="button" aria-label={`옷 사진 ${i + 1} 빼기`} onClick={() => setPhotoFiles(photoFiles.filter((_, j) => j !== i))}><IconClose /></button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {showForm && (
        <div style={{ marginTop: 20, display: 'grid', gap: 10 }}>
          {saveError && <Notice>{saveError}</Notice>}
          {!canSave && <span className="field-hint">옷 이름과 옷 종류를 채우면 저장할 수 있어요.</span>}
          <button type="button" className="btn btn-block" onClick={save} disabled={!canSave || saving}>{saving && <Spinner />}{cleaning ? '대표 이미지 정리 중' : '저장하기'}</button>
        </div>
      )}
    </>
  )
}
