import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

export function Notice({ kind = 'error', children }: { kind?: 'error' | 'info' | 'warn' | 'ok'; children: ReactNode }) {
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={kind === 'ok' ? 'check' : 'alert'} size={18} stroke={2} />
      <div>{children}</div>
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label ?? '불러오는 중'} />
}

export function Loading() {
  return <div className="loading"><Spinner /></div>
}

/**
 * 아래에서 올라오는 시트(디자인 초안 Sheet). PC에서는 화면 가운데 대화상자. Esc·바깥 누르기로 닫힌다.
 * footer를 주면 시트 아래에 고정되고, 없으면 본문 안의 .sheet-actions가 버튼 줄이 된다.
 */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // 글을 쓰는 칸에만 바로 커서를 둔다(날짜 칸은 휴대폰에서 연도가 잡혀 버린다)
    ref.current?.querySelector<HTMLElement>('.sheet-body input:is([type=text], [type=search], [type=email], :not([type])), .sheet-body textarea')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return createPortal(
    <div className="sheet-root">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400)
    return () => clearTimeout(t)
  }, [message, onDone])
  return <div className="toast" role="status">{message}</div>
}
