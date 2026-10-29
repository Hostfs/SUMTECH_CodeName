import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { fmtLoc, type Loc } from '../data/garments';
import { useGarments } from '../data/store';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 이번에 옮길 옷 수 */
  count: number;
  current?: Loc | null;
  onSubmit: (loc: Loc) => void;
}

const same = (a: Loc | null | undefined, b: Loc) => !!a && a.space === b.space && a.slot === b.slot;

export function LocationSheet({ open, onClose, count, current, onSubmit }: Props) {
  const { spaces } = useGarments();
  const [picked, setPicked] = useState<Loc | null>(current ?? null);
  useEffect(() => {
    if (open) setPicked(current ?? null);
  }, [open, current]);

  const row = (loc: Loc, label: string, indent = false) => (
    <button
      key={`${loc.space}/${loc.slot ?? ''}`}
      className={`loc-row${indent ? ' indent' : ''}`}
      data-on={same(picked, loc)}
      onClick={() => setPicked(loc)}
      role="radio"
      aria-checked={same(picked, loc)}
    >
      <span className="radio">{same(picked, loc) && <Icon name="check" size={13} stroke={3} />}</span>
      {label}
      {same(current, loc) && <em>현재 위치</em>}
    </button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={count > 1 ? `${count}벌의 보관 위치 변경` : '보관 위치 변경'}
      footer={
        <button className="btn btn-primary btn-block" disabled={!picked} onClick={() => picked && onSubmit(picked)}>
          {picked ? `${fmtLoc(picked, ' › ')}(으)로 변경` : '위치를 골라 주세요'}
        </button>
      }
    >
      <div className="loc-list" role="radiogroup" aria-label="보관 공간">
        {spaces.map((sp) =>
          sp.slots.length === 0 ? (
            row({ space: sp.name }, sp.name)
          ) : (
            <div key={sp.name} className="loc-group">
              <p className="loc-space"><Icon name="box" size={15} />{sp.name}</p>
              {sp.slots.map((slot) => row({ space: sp.name, slot }, slot, true))}
            </div>
          ),
        )}
      </div>
    </Sheet>
  );
}
