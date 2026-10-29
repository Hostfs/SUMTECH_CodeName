import { Icon } from './Icon';
import { GarmentImage } from './GarmentImage';
import { fmtLoc, isOverdue, statusOf, type Garment } from '../data/garments';

interface Props {
  garment: Garment;
  selecting: boolean;
  selected: boolean;
  onClick: () => void;
}

/** 옷 카드. 상태는 색만으로 구분하지 않고 아이콘과 문구를 함께 쓴다 (계획서 8장). */
export function GarmentCard({ garment: g, selecting, selected, onClick }: Props) {
  const status = statusOf(g);
  const overdue = isOverdue(g);
  return (
    <button
      className="gcard"
      data-selected={selected}
      data-selecting={selecting}
      onClick={onClick}
      aria-pressed={selecting ? selected : undefined}
      aria-label={`${g.name}, ${status}${overdue ? ', 회수 기한 지남' : ''}, ${fmtLoc(g.loc)}`}
    >
      <span className="gtile">
        {selecting && (
          <span className="gcheck" aria-hidden="true">
            {selected && <Icon name="check" size={14} stroke={2.6} />}
          </span>
        )}
        <span className="gbadges">
          {status !== '보관 중' && (
            <span className={`badge badge-${status === '미배치' ? 'none' : 'care'}`}>
              <Icon name={status === '세탁 중' ? 'drop' : status === '수선 중' ? 'scissors' : 'pin'} size={11} stroke={2.2} />
              {status}
            </span>
          )}
          {overdue && (
            <span className="badge badge-late">
              <Icon name="alert" size={11} stroke={2.2} />기한 지남
            </span>
          )}
        </span>
        <GarmentImage g={g} size="64%" />
      </span>
      <span className="gname">{g.name}</span>
      <span className="gloc">
        <Icon name="pin" size={13} stroke={2} />
        {g.loc ? fmtLoc(g.loc) : '위치를 정해 주세요'}
      </span>
    </button>
  );
}
