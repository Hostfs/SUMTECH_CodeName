import { useState } from 'react'
import { COLOR_PALETTE, nearestColorName } from '../colors'
import { Icon } from './Icon'

type Value = { name: string; hex: string }

/** 밝은 색 칸 위에는 어두운 체크, 어두운 색 칸 위에는 흰 체크를 그린다. */
function checkColor(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.62 ? '#1c1b1a' : '#ffffff'
}

/**
 * 색상 입력. 팔레트를 누르면 이름과 색 코드가 같이 정해지고, '직접 고르기'(스포이드 포함)로 고른 색에는
 * 가까운 이름이 붙는다. 고르는 동안은 임시 값이고 '확인'을 눌러야 반영되며 '취소'는 원래 값으로 돌린다.
 * 모양은 디자인 초안의 입력 칸(.field input)과 패널(.panel)을 따른다. labelledBy를 주면 칸 이름을 버튼 이름 앞에 붙인다.
 */
export default function ColorField({ id, value, onChange, labelledBy }: { id: string; value: Value; onChange: (v: Value) => void; labelledBy?: string }) {
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
      <button type="button" id={id} className="color-trigger" aria-expanded={open} aria-labelledby={labelledBy ? `${labelledBy} ${id}` : undefined}
        onClick={() => (open ? setOpen(false) : start())}>
        <span className="color-dot" style={{ background: value.hex || 'transparent' }} data-empty={!value.hex} />
        <span className={`color-name${shownName ? '' : ' placeholder'}`}>{shownName || '색상 고르기'}</span>
        <Icon name="chevronDown" size={18} />
      </button>
      {open && (
        <div className="color-panel" role="dialog" aria-label="색상 고르기">
          <div className="color-grid" role="group" aria-label="색상 팔레트">
            {COLOR_PALETTE.map((c) => (
              <button key={c.hex} type="button" className="color-swatch" title={c.name} aria-label={c.name}
                aria-pressed={draft.hex.toLowerCase() === c.hex} style={{ background: c.hex, color: checkColor(c.hex) }} onClick={() => pickHex(c.hex, c.name)}>
                {draft.hex.toLowerCase() === c.hex && <Icon name="check" size={14} stroke={3} />}
              </button>
            ))}
          </div>
          <div className="color-custom">
            <label className="color-pick">
              <Icon name="palette" size={16} />
              직접 고르기
              <input type="color" className="sr-only" value={draft.hex || '#d9d3c9'} onChange={(e) => pickHex(e.target.value)} aria-label="직접 고르기(스포이드)" />
            </label>
            <span className="color-dot" style={{ background: draft.hex || 'transparent' }} data-empty={!draft.hex} />
            <input aria-label="색상 이름" value={draft.name} placeholder="색상 이름"
              onChange={(e) => { setNameTouched(true); setDraft({ ...draft, name: e.target.value }) }} maxLength={50} />
          </div>
          <div className="color-actions">
            <button type="button" className="link-btn muted" onClick={() => { onChange({ name: '', hex: '' }); setOpen(false) }}>지우기</button>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>취소</button>
            <button type="button" className="btn btn-primary" onClick={() => { onChange({ name: draft.name.trim(), hex: draft.hex }); setOpen(false) }}>확인</button>
          </div>
        </div>
      )}
    </div>
  )
}
