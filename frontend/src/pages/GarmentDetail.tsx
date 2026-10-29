import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { GarmentImage } from '../components/GarmentImage';
import { GarmentFields, type FieldValues } from '../components/GarmentFields';
import { LocationSheet } from '../components/LocationSheet';
import { CareSheet } from '../components/CareSheet';
import { Sheet } from '../components/Sheet';
import { useGarments } from '../data/store';
import { colorHex, dueLabel, fmtLoc, isOverdue, statusOf, type Garment } from '../data/garments';
import { FitEditor } from '../components/FitEditor';
import { useImageUrl } from '../data/images';
import type { Points } from '../lib/cutout';
import type { Fit } from '../lib/fit';
import { useToast } from '../lib/toast';
import { eul } from '../lib/josa';

type Panel = 'move' | 'edit' | 'care' | 'delete' | 'fit' | null;

const toFields = (g: Garment): FieldValues => ({
  name: g.name,
  category: g.category,
  color: g.color,
  brand: g.brand ?? '',
  size: g.size ?? '',
  material: g.material ?? '',
  memo: g.memo ?? '',
  seasons: g.seasons,
});

function Cell({ label, value }: { label: string; value?: string }) {
  return (
    <div className="cell">
      <dt>{label}</dt>
      <dd className={value ? '' : 'unset'}>{value || '미입력'}</dd>
    </div>
  );
}

export default function GarmentDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { get, update, remove, move, completeCare } = useGarments();
  const g = id ? get(id) : undefined;

  const [panel, setPanel] = useState<Panel>(null);
  const [menu, setMenu] = useState(false);
  const [fields, setFields] = useState<FieldValues | null>(null);
  const [nameError, setNameError] = useState('');
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [fitDraft, setFitDraft] = useState<{ points: Points; fit: Fit } | null>(null);
  const photoUrl = useImageUrl(g?.photo);
  const file = useRef<HTMLInputElement>(null);

  if (!g) {
    return (
      <div className="page notfound">
        <h1>옷을 찾을 수 없어요</h1>
        <p>삭제되었거나 다른 계정의 옷일 수 있어요.</p>
        <Link to="/closet" className="btn btn-primary">내 옷장으로</Link>
      </div>
    );
  }

  const status = statusOf(g);
  const back = () => (window.history.length > 1 ? nav(-1) : nav('/closet'));

  const openEdit = () => {
    setFields(toFields(g));
    setNameError('');
    setPanel('edit');
  };
  const saveEdit = () => {
    if (!fields) return;
    if (!fields.name.trim()) return setNameError('옷 이름을 입력해 주세요');
    update(g.id, {
      name: fields.name.trim(),
      category: fields.category,
      color: fields.color.trim(),
      hex: colorHex(fields.color, g.hex),
      brand: fields.brand.trim() || undefined,
      size: fields.size.trim() || undefined,
      material: fields.material.trim() || undefined,
      memo: fields.memo.trim() || undefined,
      seasons: fields.seasons,
    });
    setPanel(null);
    toast('수정했어요');
  };

  const onLabel = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/') || f.size > 10 * 1024 * 1024) return toast('10MB 이하의 이미지만 올릴 수 있어요');
    setLabelUrl(URL.createObjectURL(f));
    toast('라벨 사진을 담았어요. 글자 읽기(AI)는 다음 단계에서 연결돼요');
  };

  return (
    <div className="page pinned detail">
      <div className="pin">
      <header className="topbar">
        <button className="icon-btn" onClick={back} aria-label="뒤로"><Icon name="chevronLeft" size={24} /></button>
        <h1>옷 정보</h1>
        <div className="menu-wrap">
          <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="더보기" aria-expanded={menu}><Icon name="more" size={22} /></button>
          {menu && (
            <>
              <div className="menu-away" onClick={() => setMenu(false)} />
              <div className="menu" role="menu">
                <button role="menuitem" onClick={() => { setMenu(false); setPanel('care'); }}><Icon name="drop" size={17} />세탁·수선 맡기기</button>
                {g.photo && <button role="menuitem" onClick={() => { setMenu(false); setFitDraft({ points: g.photo!.points, fit: g.photo!.fit }); setPanel('fit'); }}><Icon name="edit" size={17} />핏 다시 맞추기</button>}
                <button role="menuitem" onClick={() => { setMenu(false); nav('/outfit'); }}><Icon name="shirt" size={17} />코디 스튜디오로</button>
                <button role="menuitem" className="danger" onClick={() => { setMenu(false); setPanel('delete'); }}><Icon name="trash" size={17} />삭제</button>
              </div>
            </>
          )}
        </div>
      </header>
      </div>

      <div className="hero-card">
        <div className="hero-tile"><GarmentImage g={g} size="82%" /></div>
      </div>

      <div className="title-row">
        <h2>{g.name}</h2>
        {status !== '보관 중' && (
          <span className={`badge badge-lg ${status === '미배치' ? 'badge-none' : 'badge-care'}`}>
            <Icon name={status === '세탁 중' ? 'drop' : status === '수선 중' ? 'scissors' : 'pin'} size={13} stroke={2.2} />{status}
          </span>
        )}
      </div>
      <div className="season-tags">
        {g.seasons.length ? g.seasons.map((s) => <span key={s} className="tag">{s}</span>) : <span className="tag muted">계절 미입력</span>}
      </div>

      {g.care && (
        <div className={`care-banner${isOverdue(g) ? ' late' : ''}`}>
          <Icon name={g.care.kind === '세탁' ? 'drop' : 'scissors'} size={20} />
          <div>
            <b>{g.care.kind} 맡김{g.care.vendor ? ` · ${g.care.vendor}` : g.care.place === '자택' ? ' · 자택' : ''}</b>
            <small>{dueLabel(g.care.due)}{isOverdue(g) ? ' · 기한 지남' : ''}</small>
          </div>
          <button className="btn btn-sm" onClick={() => { completeCare(g.id); toast('회수했어요. 보관 위치를 확인해 주세요'); }}>회수 완료</button>
        </div>
      )}

      <div className="loc-card">
        <span className="loc-icon"><Icon name="pin" size={22} /></span>
        <div>
          <small>보관 위치</small>
          <b>{g.loc ? fmtLoc(g.loc, ' › ') : '아직 위치가 없어요'}</b>
        </div>
      </div>

      <dl className="info-grid">
        <Cell label="종류" value={g.category} />
        <Cell label="색상" value={g.color} />
        <Cell label="브랜드" value={g.brand} />
        <Cell label="사이즈" value={g.size} />
        <Cell label="소재" value={g.material} />
        <Cell label="메모" value={g.memo} />
      </dl>

      <h3 className="section-title">세탁·관리 정보</h3>
      <div className="care-card">
        {labelUrl ? <img src={labelUrl} alt="촬영한 세탁 라벨" /> : null}
        <p>
          등록된 관리 정보가 없어요.
          <br />
          세탁 라벨을 촬영해 추가할 수 있어요.
        </p>
        <button className="btn btn-outline" onClick={() => file.current?.click()}><Icon name="camera" size={18} />라벨 촬영</button>
        <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onLabel(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <div className="action-bar">
        <button className="btn btn-primary" onClick={() => setPanel('move')}>위치 변경</button>
        <button className="btn btn-ghost" onClick={openEdit}>수정</button>
        <button className="link-btn muted" onClick={() => setPanel('delete')}>삭제</button>
      </div>

      <LocationSheet
        open={panel === 'move'}
        onClose={() => setPanel(null)}
        count={1}
        current={g.loc}
        onSubmit={(loc) => {
          move([g.id], loc);
          setPanel(null);
          toast(`${fmtLoc(loc, ' › ')}(으)로 옮겼어요`);
        }}
      />

      <CareSheet
        open={panel === 'care'}
        onClose={() => setPanel(null)}
        onSubmit={(care) => {
          update(g.id, { care });
          setPanel(null);
          toast(`${eul(care.kind)} 기록했어요`);
        }}
      />

      <Sheet
        open={panel === 'edit'}
        onClose={() => setPanel(null)}
        title="정보 수정"
        footer={<button className="btn btn-primary btn-block" onClick={saveEdit}>저장</button>}
      >
        {fields && <GarmentFields value={fields} onChange={(v) => { setFields(v); setNameError(''); }} error={nameError} />}
      </Sheet>

      <Sheet
        open={panel === 'fit'}
        onClose={() => setPanel(null)}
        title="핏 다시 맞추기"
        footer={<button className="btn btn-primary btn-block" onClick={() => { if (g.photo && fitDraft) { update(g.id, { photo: { ...g.photo, ...fitDraft } }); toast('핏을 저장했어요'); } setPanel(null); }}>저장</button>}
      >
        {g.photo && fitDraft && photoUrl && (
          <div className="fields">
            <p className="hint" style={{ margin: 0 }}>점을 끌어 {g.photo.kind === 'bottom' ? '허리 양끝과 밑단' : '목·어깨 끝·소매 끝'} 위치에 맞춰 주세요.</p>
            <FitEditor src={photoUrl} w={g.photo.w} h={g.photo.h} kind={g.photo.kind} points={fitDraft.points} onChange={(points) => setFitDraft({ ...fitDraft, points })} />
            <div className="fit-row page-fit" style={{ padding: 0 }}>
              <label>품<input type="range" min="0.8" max="1.3" step="0.02" value={fitDraft.fit.width} onChange={(e) => setFitDraft({ ...fitDraft, fit: { ...fitDraft.fit, width: Number(e.target.value) } })} /></label>
              <label>기장<input type="range" min="0.8" max="1.25" step="0.02" value={fitDraft.fit.length} onChange={(e) => setFitDraft({ ...fitDraft, fit: { ...fitDraft.fit, length: Number(e.target.value) } })} /></label>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet
        open={panel === 'delete'}
        onClose={() => setPanel(null)}
        title="이 옷을 삭제할까요?"
        footer={
          <div className="foot-row">
            <button className="btn btn-ghost" onClick={() => setPanel(null)}>취소</button>
            <button className="btn btn-danger" onClick={() => { remove(g.id); toast('삭제했어요'); nav('/closet', { replace: true }); }}>삭제</button>
          </div>
        }
      >
        <p className="sheet-text">‘{g.name}’의 정보와 보관 위치 기록이 함께 사라져요. 되돌릴 수 없어요.</p>
      </Sheet>
    </div>
  );
}
