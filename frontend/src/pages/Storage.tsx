import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { GarmentImage } from '../components/GarmentImage';
import { Sheet } from '../components/Sheet';
import { useGarments } from '../data/store';
import { SPACE_KINDS, dueLabel, fmtLoc, isOverdue, isoDay, type Garment, type Space, type SpaceKind } from '../data/garments';
import { countIn, recommendPlacement, type Proposal } from '../lib/placement';
import { useTheme } from '../lib/theme';
import { useToast } from '../lib/toast';
import { eul } from '../lib/josa';

type View = 'map' | 'care';
const KIND_ICON: Record<SpaceKind, IconName> = { 걸기: 'hanger', 서랍: 'box', 선반: 'box', 상자: 'box', '집 밖': 'home' };
const KIND_HINT: Record<SpaceKind, string> = { 걸기: '행거·옷걸이', 서랍: '접어서 넣는 서랍', 선반: '신발장·선반', 상자: '계절 옷 보관 상자', '집 밖': '본가·창고처럼 집 밖' };

/** 겹쳐 놓은 작은 옷 썸네일 */
function Thumbs({ items, max = 5 }: { items: Garment[]; max?: number }) {
  if (!items.length) return <span className="thumbs-empty">비어 있어요</span>;
  return (
    <span className="thumbs">
      {items.slice(0, max).map((g) => (
        <span key={g.id} className="thumb" title={g.name}><GarmentImage g={g} size={22} /></span>
      ))}
      {items.length > max && <span className="thumb more">+{items.length - max}</span>}
    </span>
  );
}

function SpaceCard({ space, garments, onRemove }: { space: Space; garments: Garment[]; onRemove: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const inside = garments.filter((g) => g.loc?.space === space.name);
  const used = inside.length;
  const full = used >= space.capacity;
  const pct = Math.min(100, Math.round((used / space.capacity) * 100));
  const slots = space.slots.length ? space.slots : [''];

  return (
    <section className="space" aria-label={space.name}>
      <header className="space-head">
        <span className="space-ico"><Icon name={KIND_ICON[space.kind]} size={19} /></span>
        <div className="space-title">
          <h3>{space.name}</h3>
          <small>{space.kind} · {KIND_HINT[space.kind]}</small>
        </div>
        {used === 0 && (
          <button className="icon-btn" onClick={onRemove} aria-label={`${space.name} 삭제`}><Icon name="trash" size={17} /></button>
        )}
      </header>

      <div className="cap" aria-label={`${space.capacity}벌 중 ${used}벌`}>
        <div className="cap-bar"><i style={{ width: `${pct}%` }} data-full={full} /></div>
        <span data-full={full}>{full ? '가득 찼어요' : `${used}/${space.capacity}벌`}</span>
      </div>

      <ul className="slots">
        {slots.map((slot) => {
          const here = inside.filter((g) => (g.loc?.slot ?? '') === slot);
          const key = slot || '_';
          const isOpen = open === key;
          return (
            <li key={key} className="slot">
              <button className="slot-row" onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen} disabled={here.length === 0}>
                <span className="slot-name">{slot || '전체'}</span>
                <Thumbs items={here} />
                <span className="slot-count">{here.length}</span>
                <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={15} />
              </button>
              {isOpen && (
                <ul className="slot-list">
                  {here.map((g) => (
                    <li key={g.id}>
                      <Link to={`/closet/${g.id}`} className="slot-item">
                        <GarmentImage g={g} size={30} />
                        <b>{g.name}</b>
                        <small>{g.category}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function Storage() {
  const { garments, spaces, careLog, place, addSpace, removeSpace, completeCare, setDue } = useGarments();
  const { season } = useTheme();
  const toast = useToast();

  const [view, setView] = useState<View>('map');
  const [sheet, setSheet] = useState<'add' | 'plan' | 'due' | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [dueFor, setDueFor] = useState<Garment | null>(null);
  const [dueVal, setDueVal] = useState('');
  const [dueErr, setDueErr] = useState('');

  const [nf, setNf] = useState<{ name: string; kind: SpaceKind; capacity: string; slots: string }>({ name: '', kind: '걸기', capacity: '10', slots: '' });
  const [nErr, setNErr] = useState('');

  const unplaced = garments.filter((g) => !g.loc);
  const placed = garments.length - unplaced.length;
  const active = useMemo(() => garments.filter((g) => g.care).sort((a, b) => a.care!.due.localeCompare(b.care!.due)), [garments]);
  const late = active.filter(isOverdue);
  const today = active.filter((g) => g.care!.due === isoDay(0));
  const going = active.filter((g) => !isOverdue(g) && g.care!.due !== isoDay(0));
  const pct = garments.length ? Math.round((placed / garments.length) * 100) : 0;

  const openPlan = () => {
    setProposals(recommendPlacement(garments, spaces, season));
    setSheet('plan');
  };
  const confirm = (list: Proposal[]) => {
    const ok = list.filter((p) => p.loc);
    place(ok.map((p) => ({ id: p.garment.id, loc: p.loc! })));
    setProposals((prev) => prev.filter((p) => !ok.includes(p)));
    toast(`${ok.length}벌의 위치를 확정했어요`);
    if (proposals.length === ok.length) setSheet(null);
  };

  const submitSpace = async () => {
    const err = await addSpace({
      name: nf.name,
      kind: nf.kind,
      capacity: Number(nf.capacity),
      slots: nf.slots.split(',').map((s) => s.trim()).filter(Boolean),
    });
    if (err) return setNErr(err);
    setSheet(null);
    toast(`${eul(nf.name.trim())} 추가했어요`);
  };

  const openDue = (g: Garment) => {
    setDueFor(g);
    setDueVal(g.care!.due);
    setDueErr('');
    setSheet('due');
  };

  const careRow = (g: Garment, tone: 'late' | 'today' | 'go') => (
    <li key={g.id} className={`care-item ${tone}`}>
      <Link to={`/closet/${g.id}`} className="care-top">
        <span className="care-art"><GarmentImage g={g} size={34} /></span>
        <span className="care-main">
          <b>{g.name}</b>
          <small>{g.care!.kind} · {g.care!.vendor ?? g.care!.place}</small>
        </span>
        <span className="care-due">{dueLabel(g.care!.due)}</span>
      </Link>
      <div className="care-actions">
        <button className="btn btn-sm" onClick={() => { completeCare(g.id); toast(`${eul(g.name)} 회수했어요. 보관 위치를 확인해 주세요`); }}>회수 완료</button>
        <button className="btn-text" onClick={() => openDue(g)}>예정일 변경</button>
      </div>
    </li>
  );

  return (
    <div className="page pinned storage">
      <div className="pin">
      <header className="page-head">
        <h1>보관함</h1>
        {view === 'map' && <button className="link-btn" onClick={() => { setNf({ name: '', kind: '걸기', capacity: '10', slots: '' }); setNErr(''); setSheet('add'); }}>공간 추가</button>}
      </header>

      <div className="seg" role="tablist" aria-label="보관함 보기">
        <button role="tab" aria-selected={view === 'map'} data-on={view === 'map'} onClick={() => setView('map')}>옷장 지도</button>
        <button role="tab" aria-selected={view === 'care'} data-on={view === 'care'} onClick={() => setView('care')}>
          관리함{late.length + today.length > 0 && <b className="seg-dot">{late.length + today.length}</b>}
        </button>
      </div>
      </div>

      {view === 'map' ? (
        <>
          <div className="overview">
            <div className="ring" style={{ ['--p' as string]: `${pct}%` }} role="img" aria-label={`배치율 ${pct}%`}><b>{pct}<small>%</small></b></div>
            <div>
              <p className="ov-title">{garments.length}벌 중 {placed}벌이<br />제자리에 있어요</p>
              <p className="ov-sub">공간 {spaces.length}곳 · 미배치 {unplaced.length}벌</p>
            </div>
          </div>

          {unplaced.length > 0 && (
            <div className="callout">
              <div className="callout-top">
                <Thumbs items={unplaced} max={4} />
                <p><b>위치가 없는 옷 {unplaced.length}벌</b><small>{unplaced.map((g) => g.name).join(', ')}</small></p>
              </div>
              <button className="btn btn-primary btn-block" onClick={openPlan}><Icon name="sparkle" size={14} /> 배치 추천 받기</button>
            </div>
          )}

          <div className="space-list">
            {spaces.map((sp) => (
              <SpaceCard key={sp.name} space={sp} garments={garments}
                onRemove={async () => { const e = await removeSpace(sp.name); toast(e ?? `${eul(sp.name)} 지웠어요`); }} />
            ))}
          </div>
        </>
      ) : (
        <>
          {active.length === 0 && (
            <div className="empty"><p className="empty-title">맡겨 둔 옷이 없어요</p><p>옷 정보에서 ‘세탁·수선 맡기기’를 누르면 여기에 나타나요.</p></div>
          )}
          {late.length > 0 && (<><h2 className="section-title danger">기한 지남 <small>{late.length}</small></h2><ul className="care-list" aria-label="기한 지남">{late.map((g) => careRow(g, 'late'))}</ul></>)}
          {today.length > 0 && (<><h2 className="section-title">오늘 회수 예정 <small>{today.length}</small></h2><ul className="care-list" aria-label="오늘 회수 예정">{today.map((g) => careRow(g, 'today'))}</ul></>)}
          {going.length > 0 && (<><h2 className="section-title">진행 중 <small>{going.length}</small></h2><ul className="care-list" aria-label="진행 중">{going.map((g) => careRow(g, 'go'))}</ul></>)}

          <h2 className="section-title">완료 이력</h2>
          {careLog.length === 0 ? (
            <p className="muted-text">아직 회수한 기록이 없어요.</p>
          ) : (
            <ul className="history" aria-label="완료 이력">
              {careLog.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Icon name="check" size={15} stroke={2.4} />
                  <span><b>{c.name}</b> {c.kind} 회수{c.vendor ? ` · ${c.vendor}` : ''}</span>
                  <small>{c.doneAt.slice(5).replace('-', '월 ')}일</small>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* 공간 추가 */}
      <Sheet open={sheet === 'add'} onClose={() => setSheet(null)} title="공간 추가"
        footer={<button className="btn btn-primary btn-block" onClick={submitSpace}>저장</button>}>
        <div className="fields">
          <label className="field"><span>공간 이름 <i>*</i></span>
            <input value={nf.name} onChange={(e) => { setNf({ ...nf, name: e.target.value }); setNErr(''); }} placeholder="예: 현관 행거" aria-invalid={!!nErr} />
            {nErr && <small className="field-error">{nErr}</small>}
          </label>
          <div className="field"><span>유형</span>
            <div className="chips">
              {SPACE_KINDS.map((k) => <button key={k} className="chip" data-on={nf.kind === k} onClick={() => setNf({ ...nf, kind: k })} aria-pressed={nf.kind === k}>{k}</button>)}
            </div>
          </div>
          <label className="field"><span>수용 개수 (벌)</span>
            <input inputMode="numeric" value={nf.capacity} onChange={(e) => { setNf({ ...nf, capacity: e.target.value }); setNErr(''); }} placeholder="3" />
          </label>
          <label className="field"><span>칸 이름 (쉼표로 구분, 없으면 비워 두세요)</span>
            <input value={nf.slots} onChange={(e) => setNf({ ...nf, slots: e.target.value })} placeholder="예: 왼쪽, 오른쪽" />
          </label>
        </div>
      </Sheet>

      {/* 배치 추천 (미확정 → 배치 완료를 눌러야 위치가 바뀐다) */}
      <Sheet open={sheet === 'plan'} onClose={() => setSheet(null)} title="배치 추천"
        footer={proposals.some((p) => p.loc) ? <button className="btn btn-primary btn-block" onClick={() => confirm(proposals)}>전체 배치 완료</button> : undefined}>
        <p className="hint" style={{ marginTop: 0 }}>추천만으로는 위치가 바뀌지 않아요. ‘배치 완료’를 눌러야 확정돼요.</p>
        {proposals.length === 0 && <p className="muted-text">추천할 옷이 없어요.</p>}
        <ul className="plan">
          {proposals.map((p) => (
            <li key={p.garment.id} className={p.loc ? '' : 'over'}>
              <GarmentImage g={p.garment} size={38} />
              <span className="plan-main">
                <b>{p.garment.name}</b>
                <em>{p.loc ? `→ ${fmtLoc(p.loc, ' › ')}${p.loc.space && !p.loc.slot ? '' : ''}` : '자리 없음'}</em>
                <small>{p.reason}{p.loc ? ` · ${countIn(garments, p.loc.space)}/${spaces.find((s) => s.name === p.loc!.space)?.capacity}벌` : ''}</small>
              </span>
              {p.loc && <button className="btn btn-sm" onClick={() => confirm([p])}>배치 완료</button>}
            </li>
          ))}
        </ul>
      </Sheet>

      {/* 회수 예정일 변경 */}
      <Sheet open={sheet === 'due'} onClose={() => setSheet(null)} title="회수 예정일 변경"
        footer={<button className="btn btn-primary btn-block" onClick={async () => { if (!dueFor) return; const e = await setDue(dueFor.id, dueVal); if (e) setDueErr(e); else { setSheet(null); toast('예정일을 바꿨어요'); } }}>변경</button>}>
        <div className="fields">
          <p className="hint" style={{ margin: 0 }}>{dueFor?.name} · {dueFor?.care?.kind}</p>
          <label className="field"><span>회수 예정일</span>
            <input type="date" value={dueVal} min={dueFor?.care?.since} onChange={(e) => { setDueVal(e.target.value); setDueErr(''); }} aria-invalid={!!dueErr} />
            {dueErr && <small className="field-error">{dueErr}</small>}
          </label>
        </div>
      </Sheet>
    </div>
  );
}
