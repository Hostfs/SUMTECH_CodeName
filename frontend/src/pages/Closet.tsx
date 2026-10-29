import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { GarmentCard } from '../components/GarmentCard';
import { LocationSheet } from '../components/LocationSheet';
import { Sheet } from '../components/Sheet';
import { useGarments } from '../data/store';
import { CATEGORIES, STATUSES, fmtLoc, statusOf, type Category, type Garment, type Space, type StatusLabel } from '../data/garments';
import { SEASONS, type Season } from '../lib/seasons';
import { useToast } from '../lib/toast';

type Group = 'none' | 'season' | 'category' | 'place';
type Sort = 'recent' | 'name' | 'place';
interface Filters { seasons: Season[]; statuses: StatusLabel[]; group: Group }
const EMPTY: Filters = { seasons: [], statuses: [], group: 'none' };

const GROUPS: [Group, string][] = [['none', '묶지 않기'], ['season', '계절별'], ['category', '종류별'], ['place', '위치별']];

function groupItems(items: Garment[], by: Group, spaces: Space[]): { key: string; items: Garment[] }[] {
  if (by === 'none') return [{ key: '', items }];
  const keys: string[] =
    by === 'season' ? [...SEASONS] : by === 'category' ? [...CATEGORIES] : [...spaces.map((s) => s.name), '미배치'];
  return keys
    .map((key) => ({
      key,
      items: items.filter((g) =>
        by === 'season' ? g.seasons.includes(key as Season) : by === 'category' ? g.category === key : (g.loc?.space ?? '미배치') === key,
      ),
    }))
    .filter((g) => g.items.length > 0);
}

export default function Closet() {
  const { garments, spaces, move } = useGarments();
  const nav = useNavigate();
  const toast = useToast();

  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'전체' | Category>('전체');
  const [sort, setSort] = useState<Sort>('recent');
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [sheet, setSheet] = useState<'filter' | 'move' | null>(null);

  const activeCount = filters.seasons.length + filters.statuses.length + (filters.group !== 'none' ? 1 : 0);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return garments
      .filter((g) => cat === '전체' || g.category === cat)
      .filter((g) => !needle || [g.name, g.color, g.brand ?? '', fmtLoc(g.loc), g.memo ?? ''].join(' ').toLowerCase().includes(needle))
      .filter((g) => filters.seasons.length === 0 || g.seasons.some((s) => filters.seasons.includes(s)))
      .filter((g) => filters.statuses.length === 0 || filters.statuses.includes(statusOf(g)))
      .sort((a, b) =>
        sort === 'name' ? a.name.localeCompare(b.name, 'ko') : sort === 'place' ? fmtLoc(a.loc).localeCompare(fmtLoc(b.loc), 'ko') : b.createdAt - a.createdAt,
      );
  }, [garments, q, cat, filters, sort]);

  const groups = useMemo(() => groupItems(list, filters.group, spaces), [list, filters.group, spaces]);

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const endSelect = () => {
    setSelecting(false);
    setSel([]);
  };
  const reset = () => {
    setQ('');
    setCat('전체');
    setFilters(EMPTY);
  };

  const openFilter = () => {
    setDraft(filters);
    setSheet('filter');
  };
  const flip = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="page pinned closet">
      <div className="pin">
      <header className="page-head">
        <h1>
          내 옷장 <small>총 {garments.length}벌</small>
        </h1>
        {garments.length > 0 && (
          <button className="link-btn" onClick={() => (selecting ? endSelect() : setSelecting(true))}>
            {selecting ? '완료' : '선택'}
          </button>
        )}
      </header>

      <label className="search">
        <Icon name="search" size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·색상·위치로 검색" type="search" aria-label="옷 검색" />
      </label>

      <div className="chips scroll" role="tablist" aria-label="종류">
        {(['전체', ...CATEGORIES] as const).map((c) => (
          <button key={c} className="chip" data-on={cat === c} onClick={() => setCat(c)} role="tab" aria-selected={cat === c}>
            {c}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <button className="filter-btn" onClick={openFilter}>
          <Icon name="filter" size={18} />필터{activeCount > 0 && <b>{activeCount}</b>}
        </button>
        <span className="result-count">{list.length !== garments.length ? `${list.length}벌` : ''}</span>
        <label className="sort">
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬">
            <option value="recent">최근 등록순</option>
            <option value="name">이름순</option>
            <option value="place">위치순</option>
          </select>
          <Icon name="chevronDown" size={16} />
        </label>
      </div>
      </div>

      {garments.length === 0 ? (
        <div className="empty">
          <p className="empty-title">등록된 옷이 0벌이에요</p>
          <p>세탁 택을 찍으면 옷 정보와 세탁법이 자동으로 채워져요.</p>
          <Link to="/register" className="btn btn-primary">옷 등록</Link>
        </div>
      ) : list.length === 0 ? (
        <div className="empty">
          <p className="empty-title">조건에 맞는 옷이 없어요</p>
          <p>검색어나 필터를 바꿔 보세요.</p>
          <button className="btn btn-ghost" onClick={reset}>조건 초기화</button>
        </div>
      ) : (
        groups.map((grp) => (
          <section key={grp.key || 'all'} className="group" aria-label={grp.key ? `${grp.key} 묶음` : undefined}>
            {grp.key && (
              <h2 className="group-title">
                {grp.key} <small>{grp.items.length}벌</small>
              </h2>
            )}
            <div className="grid">
              {grp.items.map((g) => (
                <GarmentCard
                  key={`${grp.key}${g.id}`}
                  garment={g}
                  selecting={selecting}
                  selected={sel.includes(g.id)}
                  onClick={() => (selecting ? toggle(g.id) : nav(`/closet/${g.id}`))}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {selecting && (
        <div className="selbar" role="region" aria-label="선택한 옷">
          <b>{sel.length}개 선택됨</b>
          <button className="link-btn muted" onClick={() => setSel([])} disabled={sel.length === 0}>선택 해제</button>
          <button className="btn btn-primary" disabled={sel.length === 0} onClick={() => setSheet('move')}>위치 변경</button>
        </div>
      )}

      <Sheet
        open={sheet === 'filter'}
        onClose={() => setSheet(null)}
        title="필터"
        footer={
          <div className="foot-row">
            <button className="btn btn-ghost" onClick={() => setDraft(EMPTY)}>초기화</button>
            <button className="btn btn-primary" onClick={() => { setFilters(draft); setSheet(null); }}>적용하기</button>
          </div>
        }
      >
        <div className="fields">
          <div className="field">
            <span>계절</span>
            <div className="chips">
              {SEASONS.map((s) => (
                <button key={s} className="chip" data-on={draft.seasons.includes(s)} onClick={() => setDraft({ ...draft, seasons: flip(draft.seasons, s) })} aria-pressed={draft.seasons.includes(s)}>{s}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>상태</span>
            <div className="chips">
              {STATUSES.map((s) => (
                <button key={s} className="chip" data-on={draft.statuses.includes(s)} onClick={() => setDraft({ ...draft, statuses: flip(draft.statuses, s) })} aria-pressed={draft.statuses.includes(s)}>{s}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>보기 기준</span>
            <div className="chips">
              {GROUPS.map(([id, label]) => (
                <button key={id} className="chip" data-on={draft.group === id} onClick={() => setDraft({ ...draft, group: id })} aria-pressed={draft.group === id}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </Sheet>

      <LocationSheet
        open={sheet === 'move'}
        onClose={() => setSheet(null)}
        count={sel.length}
        onSubmit={(loc) => {
          move(sel, loc);
          toast(`${sel.length}벌을 ${fmtLoc(loc, ' › ')}(으)로 옮겼어요`);
          setSheet(null);
          endSelect();
        }}
      />
    </div>
  );
}
