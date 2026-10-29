import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { isoDay, type Care } from '../data/garments';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (care: Care) => void;
}

/** 세탁·수선 맡기기 (S7). 회수 예정일이 맡긴 날보다 앞서면 저장하지 않는다 (R08). */
export function CareSheet({ open, onClose, onSubmit }: Props) {
  const [kind, setKind] = useState<Care['kind']>('세탁');
  const [place, setPlace] = useState<Care['place']>('업체');
  const [vendor, setVendor] = useState('');
  const [due, setDue] = useState(isoDay(1));
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setKind('세탁');
      setPlace('업체');
      setVendor('');
      setDue(isoDay(1));
      setError('');
    }
  }, [open]);

  const submit = () => {
    if (!due || due < isoDay(0)) return setError('회수 예정일은 오늘 이후로 정해 주세요');
    onSubmit({ kind, place, since: isoDay(0), due, vendor: place === '업체' ? vendor.trim() || undefined : undefined });
  };

  return (
    <Sheet open={open} onClose={onClose} title="세탁·수선 맡기기" footer={<button className="btn btn-primary btn-block" onClick={submit}>기록하기</button>}>
      <div className="fields">
        <div className="field">
          <span>종류</span>
          <div className="chips">
            {(['세탁', '수선'] as const).map((k) => (
              <button key={k} className="chip" data-on={kind === k} onClick={() => setKind(k)} aria-pressed={kind === k}>{k}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>맡긴 곳</span>
          <div className="chips">
            {(['자택', '업체'] as const).map((p) => (
              <button key={p} className="chip" data-on={place === p} onClick={() => setPlace(p)} aria-pressed={place === p}>{p}</button>
            ))}
          </div>
        </div>
        {place === '업체' && (
          <label className="field"><span>업체명</span><input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="예: 동네 세탁소" /></label>
        )}
        <label className="field">
          <span>회수 예정일</span>
          <input type="date" value={due} min={isoDay(0)} onChange={(e) => { setDue(e.target.value); setError(''); }} aria-invalid={!!error} />
          {error && <small className="field-error">{error}</small>}
        </label>
      </div>
    </Sheet>
  );
}
