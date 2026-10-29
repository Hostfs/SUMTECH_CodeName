import { useEffect, useRef, type ReactNode } from 'react'
import { IconAlert, IconCheck } from './Icons'

export function Notice({ kind = 'error', children }: { kind?: 'error' | 'info' | 'warn' | 'ok'; children: ReactNode }) {
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'ok' ? <IconCheck /> : <IconAlert />}
      <div>{children}</div>
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label ?? '불러오는 중'} />
}

export function Loading() {
  return <div style={{ padding: '48px 0', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}><Spinner /></div>
}

/** 바닥에서 올라오는 시트(PC에서는 가운데 대화상자). Esc와 바깥 누르기로 닫힌다. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-grip" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600)
    return () => clearTimeout(t)
  }, [message, onDone])
  return <div className="toast" role="status">{message}</div>
}
