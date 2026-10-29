import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** 아래에서 올라오는 시트. Esc·바깥 터치로 닫힌다. */
export function Sheet({ open, title, onClose, children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = (document.getElementById('screen') ?? document.body).style.overflow;
    (document.getElementById('screen') ?? document.body).style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      (document.getElementById('screen') ?? document.body).style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  // 앱 화면(.device) 맨 위에 띄운다. 헤더처럼 쌓임 순서가 낮은 곳에서 열어도 하단 탭 위에 보인다.
  return createPortal(
    <div className="sheet-root">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.querySelector('.device') ?? document.body,
  );
}
