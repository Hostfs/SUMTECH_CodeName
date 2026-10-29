import { useState } from 'react'
import { COLOR_PALETTE, nearestColorName } from '../colors'

type Value = { name: string; hex: string }

/**
 * 색상 입력. 팔레트를 누르면 이름과 색 코드가 같이 정해지고, '직접 고르기'(스포이드 포함)로 고른 색에는
 * 가까운 이름이 붙는다. 고르는 동안은 임시 값이고 '확인'을 눌러야 반영되며 '취소'는 원래 값으로 돌린다.
 */
export default function ColorField({ id, value, onChange }: { id: string; value: Value; onChange: (v: Value) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Value>(value)
  const [nameTouched, setNameTouched] = useState(false)

  function start() {
    setDraft(value)
    setNameTouched(false)
    setOpen(true)
  }

  function pickHex(hex: string, name?: string) {
    setDraft((d) => ({ hex, name: name ?? (nameTouched && d.name ? d.name : nearestColorName(hex) ?? d.name) }))
    if (name) setNameTouched(false)
  }

  const shownName = value.name || nearestColorName(value.hex)

  return (
    <div className="color-field">
      <button type="button" id={id} className="input color-trigger" aria-expanded={open} onClick={() => (open ? setOpen(false) : start())}>
        <span className="color-dot" style={{ background: value.hex || 'transparent' }} data-empty={!value.hex} />
        <span className={shownName ? '' : 'placeholder'}>{shownName || '색상 고르기'}</span>
      </button>
      {open && (
        <div className="color-panel" role="dialog" aria-label="색상 고르기">
          <div className="color-grid" role="group" aria-label="색상 팔레트">
            {COLOR_PALETTE.map((c) => (
              <button key={c.hex} type="button" className="color-swatch" title={c.name} aria-label={c.name}
                aria-pressed={draft.hex.toLowerCase() === c.hex} style={{ background: c.hex }} onClick={() => pickHex(c.hex, c.name)} />
            ))}
          </div>
          <div className="color-custom">
            <label className="btn btn-sm btn-outline">
              직접 고르기
              <input type="color" className="sr-only" value={draft.hex || '#d9d3c9'} onChange={(e) => pickHex(e.target.value)} aria-label="직접 고르기(스포이드)" />
            </label>
            <span className="color-dot" style={{ background: draft.hex || 'transparent' }} data-empty={!draft.hex} />
            <input className="input" aria-label="색상 이름" value={draft.name} placeholder="색상 이름"
              onChange={(e) => { setNameTouched(true); setDraft({ ...draft, name: e.target.value }) }} maxLength={50} />
          </div>
          <div className="sheet-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => { onChange({ name: '', hex: '' }); setOpen(false) }}>지우기</button>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setOpen(false)}>취소</button>
            <button type="button" className="btn btn-sm" onClick={() => { onChange({ name: draft.name.trim(), hex: draft.hex }); setOpen(false) }}>확인</button>
          </div>
        </div>
      )}
    </div>
  )
}
