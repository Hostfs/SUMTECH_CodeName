import type { GarmentFormValue, MaterialRow } from '../garmentForm'
import { useSession } from '../session'
import ColorField from './ColorField'
import { IconClose, IconPlus } from './Icons'

type Flags = Partial<Record<string, 'ai' | 'check'>>

function Flag({ f }: { f?: 'ai' | 'check' }) {
  if (f === 'check') return <span className="field-flag">확인 필요</span>
  if (f === 'ai') return <span className="field-flag" style={{ background: 'var(--accent-soft-2)', color: 'var(--accent)' }}>택에서 읽음</span>
  return null
}

/** 옷 정보 입력. 등록과 수정이 같은 칸을 쓴다. flags로 택에서 읽은 값과 확인이 필요한 값을 표시한다. */
export default function GarmentForm({ value, onChange, flags = {} }: { value: GarmentFormValue; onChange: (v: GarmentFormValue) => void; flags?: Flags }) {
  const { meta } = useSession()
  const set = <K extends keyof GarmentFormValue>(k: K, x: GarmentFormValue[K]) => onChange({ ...value, [k]: x })
  const toggleSeason = (s: string) => set('seasons', value.seasons.includes(s) ? value.seasons.filter((x) => x !== s) : [...value.seasons, s])
  const setMaterial = (i: number, patch: Partial<MaterialRow>) => set('materials', value.materials.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const sums = value.materials.reduce<Record<string, number>>((acc, m) => {
    if (m.part && m.percent) acc[m.part] = (acc[m.part] ?? 0) + Number(m.percent)
    return acc
  }, {})
  const badSums = Object.entries(sums).filter(([, n]) => Math.abs(n - 100) > 0.001)

  return (
    <>
      <div className="field">
        <label htmlFor="g-name">옷 이름 <Flag f={flags.NAME} /></label>
        <input id="g-name" className="input" value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="예: 네이비 옥스퍼드 셔츠" maxLength={100} required />
      </div>

      <div className="form-grid two">
        <div className="field">
          <label htmlFor="g-sub">옷 종류 <Flag f={flags.SUB_TYPE} /></label>
          <select id="g-sub" className="select" value={value.subType} onChange={(e) => set('subType', e.target.value)} required>
            <option value="">골라 주세요</option>
            {meta?.categories.map((c) => (
              <optgroup key={c.value} label={c.label}>
                {meta.subTypes.filter((s) => s.category === c.value).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="g-color">색상 <Flag f={flags.COLOR} /></label>
          <ColorField id="g-color" value={{ name: value.colorName, hex: value.colorHex }}
            onChange={(c) => onChange({ ...value, colorName: c.name, colorHex: c.hex })} />
        </div>
        <div className="field">
          <label htmlFor="g-brand">브랜드 <Flag f={flags.BRAND} /></label>
          <input id="g-brand" className="input" value={value.brand} onChange={(e) => set('brand', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="g-code">품번 <Flag f={flags.PRODUCT_CODE} /></label>
          <input id="g-code" className="input" value={value.productCode} onChange={(e) => set('productCode', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="g-size">표기 사이즈 <Flag f={flags.SIZE_LABEL} /></label>
          <input id="g-size" className="input" value={value.sizeLabel} onChange={(e) => set('sizeLabel', e.target.value)} placeholder="예: M, 100" />
        </div>
        <div className="field">
          <label htmlFor="g-origin">원산지 <Flag f={flags.ORIGIN} /></label>
          <input id="g-origin" className="input" value={value.origin} onChange={(e) => set('origin', e.target.value)} />
        </div>
      </div>

      <div className="field">
        <span className="field-label" id="g-seasons">계절 <Flag f={flags.SEASONS} /></span>
        <div className="chips wrap" role="group" aria-labelledby="g-seasons" style={{ marginTop: 0 }}>
          {meta?.seasons.map((s) => (
            <button key={s.value} type="button" className="chip" aria-pressed={value.seasons.includes(s.value)} onClick={() => toggleSeason(s.value)}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="form-grid two">
        <div className="field">
          <label htmlFor="g-coll">컬렉션</label>
          <input id="g-coll" className="input" value={value.collections} onChange={(e) => set('collections', e.target.value)} placeholder="쉼표로 구분, 예: 출근, 여행" />
        </div>
        <div className="field">
          <label htmlFor="g-freq">자주 입는 정도</label>
          <select id="g-freq" className="select" value={value.wearFrequency} onChange={(e) => set('wearFrequency', e.target.value)}>
            {meta?.wearFrequencies.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <span className="field-label">소재 <Flag f={flags.MATERIAL} /></span>
        {value.materials.map((m, i) => (
          <div className="material-row" key={i}>
            <select className="select" aria-label={`소재 ${i + 1} 부위`} value={m.part} onChange={(e) => setMaterial(i, { part: e.target.value })}>
              {meta?.materialParts.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select className="select" aria-label={`소재 ${i + 1} 섬유`} value={m.fiber} onChange={(e) => setMaterial(i, { fiber: e.target.value })}>
              <option value="">섬유</option>
              {meta?.fibers.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <input className="input" aria-label={`소재 ${i + 1} 혼용률(%)`} inputMode="decimal" value={m.percent} onChange={(e) => setMaterial(i, { percent: e.target.value.replace(/[^\d.]/g, '') })} placeholder="%" />
            <button type="button" className="icon-btn" aria-label={`소재 ${i + 1} 지우기`} onClick={() => set('materials', value.materials.filter((_, j) => j !== i))}><IconClose /></button>
          </div>
        ))}
        <button type="button" className="btn btn-sm btn-outline" style={{ alignSelf: 'flex-start' }}
          onClick={() => set('materials', [...value.materials, { part: 'SHELL', fiber: '', percent: '' }])}><IconPlus />소재 추가</button>
        {badSums.length > 0 && <span className="field-hint" style={{ color: 'var(--warn)' }}>부위별 합계가 100%가 되어야 저장돼요 ({badSums.map(([p, n]) => `${meta?.materialParts.find((x) => x.value === p)?.label ?? p} ${n}%`).join(', ')})</span>}
      </div>

      <div className="form-grid two">
        <div className="field">
          <label htmlFor="g-care">세탁·관리 <Flag f={flags.CARE} /></label>
          <textarea id="g-care" className="textarea" value={value.careLines} onChange={(e) => set('careLines', e.target.value)} placeholder={'한 줄에 하나씩\n예: 30도 이하 물세탁'} />
        </div>
        <div className="field">
          <label htmlFor="g-len">총장(cm)</label>
          <input id="g-len" className="input" inputMode="decimal" value={value.totalLengthCm} onChange={(e) => set('totalLengthCm', e.target.value.replace(/[^\d.]/g, ''))} placeholder="3D 코디의 옷 길이에 써요" />
        </div>
      </div>
    </>
  )
}
