import { useId, useState } from 'react'
import type { GarmentFormValue, MaterialRow } from '../garmentForm'
import { useSession } from '../session'
import ColorField from './ColorField'
import GarmentArt from './GarmentArt'
import { Icon } from './Icon'
import '../styles/register.app.css'

// ai: 택에서 읽은 값 그대로, edited: 읽은 값을 사용자가 고침(저장 때 AI가 채운 항목에서 빠진다), check: 읽지 못해 확인이 필요함
type Flag = 'ai' | 'edited' | 'check'
type Flags = Partial<Record<string, Flag>>

// 옷 종류 타일: 디자인 초안 옷 등록의 '종류 먼저 고르기'(.kinds)처럼 그림과 짧은 설명을 붙인다. 그림은 그 분류의 대표 옷 종류로 그린다.
const KIND_TILE: Record<string, { art: string; desc: string }> = {
  TOP: { art: 'KNIT', desc: '티·셔츠·니트' },
  OUTER: { art: 'COAT', desc: '재킷·코트' },
  BOTTOM: { art: 'PANTS', desc: '바지·치마' },
  DRESS: { art: 'DRESS', desc: '원피스' },
  ETC: { art: 'ETC', desc: '그 밖의 옷' },
}
// 초안과 같은 색: 고른 타일은 따뜻한 베이지, 나머지는 옅은 회색
const ART_ON = '#C9A57B'
const ART_OFF = '#D8D2C6'

function FlagTag({ f }: { f?: Flag }) {
  if (f === 'check') return <em className="field-flag" data-kind="check">확인 필요</em>
  if (f === 'edited') return <em className="field-flag" data-kind="edited">직접 고침</em>
  if (f === 'ai') return <em className="field-flag" data-kind="ai">택에서 읽음</em>
  return null
}

/**
 * 옷 정보 입력. 등록과 수정이 같은 칸을 쓴다. flags로 택에서 읽은 값과 확인이 필요한 값을 표시한다.
 * 디자인 초안의 GarmentFields(.fields·.field·.chips·.field-row)를 그대로 쓰고, 초안에 없는 칸(품번·원산지·소재·세탁·컬렉션·총장)도 같은 부품으로 만든다.
 */
export default function GarmentForm({ value, onChange, flags = {} }: { value: GarmentFormValue; onChange: (v: GarmentFormValue) => void; flags?: Flags }) {
  const { meta } = useSession()
  const uid = useId()
  const set = <K extends keyof GarmentFormValue>(k: K, x: GarmentFormValue[K]) => onChange({ ...value, [k]: x })
  const toggleSeason = (s: string) => set('seasons', value.seasons.includes(s) ? value.seasons.filter((x) => x !== s) : [...value.seasons, s])
  const setMaterial = (i: number, patch: Partial<MaterialRow>) => set('materials', value.materials.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const sums = value.materials.reduce<Record<string, number>>((acc, m) => {
    if (m.part && m.percent) acc[m.part] = (acc[m.part] ?? 0) + Number(m.percent)
    return acc
  }, {})
  const badSums = Object.entries(sums).filter(([, n]) => Math.abs(n - 100) > 0.001)

  // 옷 종류는 분류(상의·하의…)를 먼저 고르고 세부 종류를 고른다. 세부 종류가 정해져 있으면 그 분류를 보여 준다.
  const subTypes = meta?.subTypes ?? []
  const categoryOf = (sub: string) => subTypes.find((s) => s.value === sub)?.category ?? ''
  const [pickedCategory, setPickedCategory] = useState('')
  const category = categoryOf(value.subType) || pickedCategory
  const categorySubs = subTypes.filter((s) => s.category === category)

  function pickCategory(c: string) {
    setPickedCategory(c)
    if (categoryOf(value.subType) === c) return
    // 다른 분류로 바꾸면 세부 종류를 다시 고른다. 세부 종류가 하나뿐인 분류(원피스 등)는 바로 정한다.
    const subs = subTypes.filter((s) => s.category === c)
    set('subType', subs.length === 1 ? subs[0].value : '')
  }

  return (
    <div className="fields gform">
      <label className="field" data-flag={flags.NAME}>
        <span>옷 이름 <i>*</i><FlagTag f={flags.NAME} /></span>
        <input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="예: 네이비 옥스퍼드 셔츠" maxLength={100} required />
      </label>

      <div className="field" data-flag={flags.SUB_TYPE}>
        <span id={`${uid}-kind`}>옷 종류 <i>*</i><FlagTag f={flags.SUB_TYPE} /></span>
        <div className="kinds gform-kinds" role="radiogroup" aria-labelledby={`${uid}-kind`}>
          {meta?.categories.map((c) => {
            const on = category === c.value
            const tile = KIND_TILE[c.value]
            return (
              <button key={c.value} type="button" className="kind" role="radio" aria-checked={on} data-on={on} onClick={() => pickCategory(c.value)}>
                <span className="kind-art"><GarmentArt subType={tile?.art ?? c.value} colorHex={on ? ART_ON : ART_OFF} size={44} /></span>
                <b>{c.label}</b>
                {/* 설명은 보기용. 버튼 이름은 분류 이름만(세부 종류 칩 '셔츠'·'니트'와 이름이 겹치지 않게) */}
                {tile && <small aria-hidden="true">{tile.desc}</small>}
              </button>
            )
          })}
        </div>
        {categorySubs.length > 1 && (
          <div className="chips gform-subs" role="radiogroup" aria-label="세부 종류">
            {categorySubs.map((s) => (
              <button key={s.value} type="button" className="chip" role="radio" aria-checked={value.subType === s.value} data-on={value.subType === s.value}
                onClick={() => set('subType', s.value)}>{s.label}</button>
            ))}
          </div>
        )}
      </div>

      <div className="field" data-flag={flags.SEASONS}>
        <span id={`${uid}-seasons`}>계절<FlagTag f={flags.SEASONS} /></span>
        <div className="chips" role="group" aria-labelledby={`${uid}-seasons`}>
          {meta?.seasons.map((s) => (
            <button key={s.value} type="button" className="chip" data-on={value.seasons.includes(s.value)} aria-pressed={value.seasons.includes(s.value)}
              onClick={() => toggleSeason(s.value)}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="field" data-flag={flags.COLOR}>
        <span id={`${uid}-color`}>색상<FlagTag f={flags.COLOR} /></span>
        <ColorField id={`${uid}-color-value`} labelledBy={`${uid}-color`} value={{ name: value.colorName, hex: value.colorHex }}
          onChange={(c) => onChange({ ...value, colorName: c.name, colorHex: c.hex })} />
      </div>

      <div className="field-row">
        <label className="field" data-flag={flags.BRAND}>
          <span>브랜드<FlagTag f={flags.BRAND} /></span>
          <input value={value.brand} onChange={(e) => set('brand', e.target.value)} placeholder="미입력" />
        </label>
        <label className="field" data-flag={flags.PRODUCT_CODE}>
          <span>품번<FlagTag f={flags.PRODUCT_CODE} /></span>
          <input value={value.productCode} onChange={(e) => set('productCode', e.target.value)} placeholder="택에 적힌 품번" />
        </label>
      </div>
      <div className="field-row">
        <label className="field" data-flag={flags.SIZE_LABEL}>
          <span>표기 사이즈<FlagTag f={flags.SIZE_LABEL} /></span>
          <input value={value.sizeLabel} onChange={(e) => set('sizeLabel', e.target.value)} placeholder="예: M, 100" />
        </label>
        <label className="field" data-flag={flags.ORIGIN}>
          <span>원산지<FlagTag f={flags.ORIGIN} /></span>
          <input value={value.origin} onChange={(e) => set('origin', e.target.value)} placeholder="미입력" />
        </label>
      </div>

      <div className="field" data-flag={flags.MATERIAL}>
        <span id={`${uid}-mat`}>소재<FlagTag f={flags.MATERIAL} /></span>
        {value.materials.length > 0 && (
          <div className="gform-mats" role="group" aria-labelledby={`${uid}-mat`}>
            {value.materials.map((m, i) => (
              <div className="gform-mat" key={i}>
                <select aria-label={`소재 ${i + 1} 부위`} value={m.part} onChange={(e) => setMaterial(i, { part: e.target.value })}>
                  {meta?.materialParts.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <select aria-label={`소재 ${i + 1} 섬유`} value={m.fiber} onChange={(e) => setMaterial(i, { fiber: e.target.value })}>
                  <option value="">섬유</option>
                  {meta?.fibers.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <span className="gform-pct">
                  <input aria-label={`소재 ${i + 1} 혼용률(%)`} inputMode="decimal" value={m.percent} placeholder="0"
                    onChange={(e) => setMaterial(i, { percent: e.target.value.replace(/[^\d.]/g, '') })} />
                  <i aria-hidden="true">%</i>
                </span>
                <button type="button" className="icon-btn" aria-label={`소재 ${i + 1} 지우기`} onClick={() => set('materials', value.materials.filter((_, j) => j !== i))}>
                  <Icon name="close" size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="gform-add" onClick={() => set('materials', [...value.materials, { part: 'SHELL', fiber: '', percent: '' }])}>
          <Icon name="plus" size={16} stroke={2.2} />소재 추가
        </button>
        {badSums.length > 0 && (
          <small className="gform-warn">부위별 합계가 100%가 되어야 저장돼요 ({badSums.map(([p, n]) => `${meta?.materialParts.find((x) => x.value === p)?.label ?? p} ${n}%`).join(', ')})</small>
        )}
      </div>

      <label className="field" data-flag={flags.CARE}>
        <span>세탁·관리<FlagTag f={flags.CARE} /></span>
        <textarea value={value.careLines} onChange={(e) => set('careLines', e.target.value)} placeholder={'한 줄에 하나씩\n예: 30도 이하 물세탁'} rows={4} />
      </label>

      <div className="field">
        <span id={`${uid}-freq`}>자주 입는 정도</span>
        <div className="chips" role="radiogroup" aria-labelledby={`${uid}-freq`}>
          {meta?.wearFrequencies.map((w) => (
            <button key={w.value} type="button" className="chip" role="radio" aria-checked={value.wearFrequency === w.value} data-on={value.wearFrequency === w.value}
              onClick={() => set('wearFrequency', w.value)}>{w.label}</button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>컬렉션</span>
        <input value={value.collections} onChange={(e) => set('collections', e.target.value)} placeholder="쉼표로 구분, 예: 출근, 여행" />
      </label>

      <label className="field">
        <span>총장(cm)</span>
        <input inputMode="decimal" value={value.totalLengthCm} onChange={(e) => set('totalLengthCm', e.target.value.replace(/[^\d.]/g, ''))} placeholder="3D 코디의 옷 길이에 써요" />
      </label>
    </div>
  )
}
