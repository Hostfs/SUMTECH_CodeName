import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';
import { GarmentImage } from '../components/GarmentImage';
import { Sheet } from '../components/Sheet';
import { useGarments } from '../data/store';
import { BODY_LABEL, BODY_RANGE, useOutfits, validateBody } from '../data/outfits';
import { statusOf, type Garment } from '../data/garments';
import { Studio2D } from '../components/Studio2D';
import { DEFAULT_FIT } from '../lib/fit';
import { SITUATIONS, suggestOutfits, type Situation, type Suggestion } from '../lib/outfitRec';
import { SEASONS, type Season } from '../lib/seasons';
import { useTheme } from '../lib/theme';
import { useToast } from '../lib/toast';
import { eul } from '../lib/josa';

type Tab = 'dress' | 'ai';
type Slot = 'outer' | 'top' | 'bottom' | 'shoes';
type BodyKey = keyof typeof BODY_RANGE;
const BODY_KEYS: BodyKey[] = ['height', 'shoulder', 'chest', 'waist'];
const SLOTS: Slot[] = ['outer', 'top', 'bottom', 'shoes'];

const SLOT_LABEL: Record<Slot, string> = { outer: '아우터', top: '상의', bottom: '하의', shoes: '신발' };
const SLOT_CATEGORY: Record<Slot, Garment['category']> = { outer: '아우터', top: '상의', bottom: '하의', shoes: '신발' };
// 말풍선은 모형 양옆에 두어 몸을 가리지 않는다
const SLOT_SIDE: Record<Slot, 'left' | 'right'> = { outer: 'left', top: 'right', bottom: 'right', shoes: 'left' };

function PickTile({ g, on, onPick }: { g: Garment | null; on: boolean; onPick: () => void }) {
  const status = g ? statusOf(g) : null;
  return (
    <button className="pick" data-on={on} onClick={onPick} aria-pressed={on}>
      <span className="pick-art">
        {g ? <GarmentImage g={g} size={46} /> : <Icon name="close" size={20} />}
        {status && status !== '보관 중' && <i className="pick-flag">{status}</i>}
      </span>
      <span className="pick-name">{g ? g.name : '선택 안 함'}</span>
    </button>
  );
}

/** 코디 한 벌을 작은 그림으로. null 은 지워진 옷 자리, undefined 는 처음부터 비어 있던 자리(그리지 않음) */
function Mini({ items }: { items: (Garment | null | undefined)[] }) {
  const list = items.filter((g): g is Garment | null => g !== undefined);
  return (
    <span className="mini-pair">
      {list.map((g, i) => (g ? <GarmentImage key={g.id} g={g} size={30} /> : <i key={`gone${i}`} className="mini-gone" />))}
    </span>
  );
}

/** 모형을 가리지 않는 낮은 선택 트레이. 고를 때마다 위의 모형이 바로 바뀐다. */
function Tray({ slot, list, selectedId, onPick, onFit, onClose }: { slot: Slot; list: Garment[]; selectedId: string | null; onPick: (id: string | null) => void; onFit: (g: Garment, fit: { width: number; length: number }) => void; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  const current = list.find((g) => g.id === selectedId);
  const fit = current?.photo?.fit ?? DEFAULT_FIT;
  return createPortal(
    <div className="tray" role="dialog" aria-label={`${SLOT_LABEL[slot]} 고르기`}>
      <div className="tray-head">
        <b>{SLOT_LABEL[slot]}</b>
        <small>{current ? current.name : '선택 안 함'}</small>
        <button className="btn-text tray-done" onClick={onClose}>완료</button>
      </div>
      {list.length === 0 ? (
        <p className="muted-text tray-empty">등록된 {SLOT_LABEL[slot]} 옷이 없어요.</p>
      ) : (
        <div className="rail" aria-label={`${SLOT_LABEL[slot]} 목록`}>
          <PickTile g={null} on={!selectedId} onPick={() => onPick(null)} />
          {list.map((g) => <PickTile key={g.id} g={g} on={selectedId === g.id} onPick={() => onPick(g.id)} />)}
        </div>
      )}
      {current?.photo && slot !== 'shoes' && (
        <div className="fit-row" aria-label="핏 조절">
          <label>품<input type="range" min="0.8" max="1.3" step="0.02" value={fit.width} onChange={(e) => onFit(current, { ...fit, width: Number(e.target.value) })} /></label>
          <label>기장<input type="range" min="0.8" max="1.25" step="0.02" value={fit.length} onChange={(e) => onFit(current, { ...fit, length: Number(e.target.value) })} /></label>
        </div>
      )}
    </div>,
    document.querySelector('.device') ?? document.body,
  );
}

export default function Outfit() {
  const { garments, update } = useGarments();
  const { body, setBody, outfits, saveOutfit, removeOutfit } = useOutfits();
  const { season: themeSeason } = useTheme();
  const toast = useToast();

  const bySlot = useMemo(
    () => ({
      outer: garments.filter((g) => g.category === SLOT_CATEGORY.outer),
      top: garments.filter((g) => g.category === SLOT_CATEGORY.top),
      bottom: garments.filter((g) => g.category === SLOT_CATEGORY.bottom),
      shoes: garments.filter((g) => g.category === SLOT_CATEGORY.shoes),
    }),
    [garments],
  );

  const [tab, setTab] = useState<Tab>('dress');
  const [sel, setSel] = useState<Record<Slot, string | null>>(() => {
    const s = suggestOutfits(garments, themeSeason, '캐주얼')[0];
    // 아우터는 기본이 '없음'이다. 필요할 때 말풍선을 눌러 골라 입는다.
    return { outer: null, top: s?.top.id ?? null, bottom: s?.bottom.id ?? null, shoes: s?.shoes?.id ?? null };
  });
  const [tray, setTray] = useState<Slot | null>(null);
  const [zoom, setZoom] = useState(1);
  const [sheet, setSheet] = useState<'body' | 'save' | null>(null);

  const [fields, setFields] = useState<Record<BodyKey, string>>({ height: '', shoulder: '', chest: '', waist: '' });
  const [errors, setErrors] = useState<Partial<Record<BodyKey, string>>>({});
  const [outfitName, setOutfitName] = useState('');

  const [season, setSeason] = useState<Season>(themeSeason);
  const [situation, setSituation] = useState<Situation>('출근');
  const [results, setResults] = useState<Suggestion[] | null>(null);

  const worn: Record<Slot, Garment | null> = {
    outer: bySlot.outer.find((g) => g.id === sel.outer) ?? null,
    top: bySlot.top.find((g) => g.id === sel.top) ?? null,
    bottom: bySlot.bottom.find((g) => g.id === sel.bottom) ?? null,
    shoes: bySlot.shoes.find((g) => g.id === sel.shoes) ?? null,
  };
  const wornList = SLOTS.map((s) => worn[s]).filter((g): g is Garment => !!g);
  const inactive = wornList.filter((g) => statusOf(g) !== '보관 중');

  const toTop = () => document.getElementById('screen')?.scrollTo({ top: 0, behavior: 'smooth' });
  const choose = (slot: Slot, id: string | null) => setSel((s) => ({ ...s, [slot]: id }));
  const openTray = (slot: Slot) => {
    setTray(slot);
    toTop();
  };

  const openBody = () => {
    setFields({
      height: body ? String(body.height) : '',
      shoulder: body?.shoulder ? String(body.shoulder) : '',
      chest: body?.chest ? String(body.chest) : '',
      waist: body?.waist ? String(body.waist) : '',
    });
    setErrors({});
    setSheet('body');
  };
  const applyBody = () => {
    const r = validateBody(fields);
    if (!r.body) return setErrors(r.errors);
    setBody(r.body);
    setSheet(null);
    toast(`키 ${r.body.height}cm로 적용했어요`);
  };

  const suggestionSel = (s: Suggestion) => ({ outer: s.outer?.id ?? null, top: s.top.id, bottom: s.bottom.id, shoes: s.shoes?.id ?? null });
  const wear = (s: Suggestion) => {
    setSel(suggestionSel(s));
    setTab('dress');
    toTop();
  };
  const askSave = (name: string) => {
    setOutfitName(name);
    setSheet('save');
  };
  const doSave = () => {
    if (!outfitName.trim()) return;
    saveOutfit(outfitName, { topId: sel.top, outerId: sel.outer, bottomId: sel.bottom, shoesId: sel.shoes });
    setSheet(null);
    toast(`${eul(outfitName.trim())} 저장했어요`);
  };

  const bubble = (slot: Slot) => {
    const g = worn[slot];
    return (
      <button key={slot} className="bubble" data-slot={slot} data-side={SLOT_SIDE[slot]} data-on={tray === slot} data-filled={!!g}
        onClick={() => (tray === slot ? setTray(null) : openTray(slot))}
        aria-label={`${SLOT_LABEL[slot]} 고르기${g ? `, 지금: ${g.name}` : ''}`}>
        <span className="bub-ico">{g ? <GarmentImage g={g} size={24} /> : <i>?</i>}</span>
        <span className="bub-lab">{SLOT_LABEL[slot]}</span>
      </button>
    );
  };

  return (
    <div className="page pinned outfit">
      <div className="pin">
        <header className="page-head">
          <h1>코디 스튜디오</h1>
        </header>
        <div className="seg" role="tablist" aria-label="코디 방식">
          <button role="tab" aria-selected={tab === 'dress'} data-on={tab === 'dress'} onClick={() => setTab('dress')}>직접 입히기</button>
          <button role="tab" aria-selected={tab === 'ai'} data-on={tab === 'ai'} onClick={() => { setTab('ai'); setTray(null); }}>
            <Icon name="sparkle" size={13} /> 추천 받기
          </button>
        </div>
      </div>

      {tab === 'dress' ? (
        <>
          <div className="viewer2">
            {/* 정보 줄은 모형 위에 겹치지 않도록 따로 둔다 */}
            <div className="vbar vbar-top" aria-label="현재 코디 정보">
              <span>{body ? `키 ${body.height}cm` : '기본 체형 170cm'}</span>
              {wornList.map((g) => <span key={g.id}>{g.name}</span>)}
            </div>

            <div className="vstage">
              <Studio2D body={body} outer={worn.outer} top={worn.top} bottom={worn.bottom} shoes={worn.shoes} zoom={zoom} />
              {SLOTS.map(bubble)}
              <div className="vtools">
                <button onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(1)))} aria-label="확대"><Icon name="plus" size={17} /></button>
                <button onClick={() => setZoom((z) => Math.max(0.8, +(z - 0.2).toFixed(1)))} aria-label="축소"><span className="minus" /></button>
              </div>
            </div>
          </div>

          {inactive.length > 0 && (
            <p className="notice warn"><Icon name="alert" size={16} />{inactive.map((g) => `${g.name}(${statusOf(g)})`).join(', ')}은(는) 지금 입을 수 없어요.</p>
          )}

          <button className="body-row" onClick={openBody}>
            <Icon name="user" size={18} />
            <span>
              {body
                ? [`키 ${body.height}cm`, body.shoulder && `어깨 ${body.shoulder}`, body.chest && `가슴 ${body.chest}`, body.waist && `허리 ${body.waist}`].filter(Boolean).join(' · ')
                : '신체 치수를 넣으면 모형이 내 체형에 맞춰져요'}
            </span>
            <em>{body ? '수정' : '입력'}</em>
          </button>

          <button className="btn btn-primary btn-block save-btn" disabled={wornList.length === 0} onClick={() => askSave('')}>코디 저장</button>

          <h2 className="rail-title">저장한 코디 <small>{outfits.length}개</small></h2>
          {outfits.length === 0 ? (
            <p className="muted-text">아직 저장한 코디가 없어요.</p>
          ) : (
            <ul className="plain-list">
              {outfits.map((o) => {
                const find = (id?: string | null) => (id ? garments.find((g) => g.id === id) ?? null : undefined);
                const items = [find(o.outerId), find(o.topId), find(o.bottomId), find(o.shoesId)];
                return (
                  <li key={o.id} className="saved">
                    <button className="saved-main" onClick={() => { setSel({ outer: o.outerId ?? null, top: o.topId, bottom: o.bottomId, shoes: o.shoesId ?? null }); toTop(); }}>
                      <Mini items={items} />
                      <span>
                        <b>{o.name}</b>
                        <small>{items.map((g) => (g === null ? '삭제된 옷' : g?.name)).filter(Boolean).join(' + ')}</small>
                      </span>
                    </button>
                    <button className="icon-btn" onClick={() => { removeOutfit(o.id); toast('코디를 지웠어요'); }} aria-label={`${o.name} 삭제`}><Icon name="trash" size={18} /></button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="hint">지금 입을 수 있는 옷(세탁·수선 중이거나 위치가 없는 옷은 빼요)으로 계절과 상황에 맞는 조합을 골라 드려요.</p>
          <div className="field">
            <span>계절</span>
            <div className="chips">
              {SEASONS.map((s) => <button key={s} className="chip" data-on={season === s} onClick={() => setSeason(s)} aria-pressed={season === s}>{s}</button>)}
            </div>
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <span>상황</span>
            <div className="chips">
              {SITUATIONS.map((s) => <button key={s} className="chip" data-on={situation === s} onClick={() => setSituation(s)} aria-pressed={situation === s}>{s}</button>)}
            </div>
          </div>
          <button className="btn btn-primary btn-block save-btn" onClick={() => setResults(suggestOutfits(garments, season, situation))}>
            <Icon name="sparkle" size={15} /> 추천 받기
          </button>
          <p className="fine">지금은 규칙 기반 추천이에요. AI 모델이 연결되면 같은 화면에서 이유까지 더 자세히 알려 드려요.</p>

          {results && (results.length === 0 ? (
            <div className="empty">
              <p className="empty-title">추천할 조합이 없어요</p>
              <p>지금 입을 수 있는 상의와 하의가 하나씩은 있어야 해요.</p>
            </div>
          ) : (
            <ul className="plain-list sug-list" aria-label="추천 결과">
              {results.map((s, i) => (
                <li key={s.top.id + s.bottom.id} className="sug">
                  <div className="sug-head">
                    <span className="sug-rank">{i + 1}</span>
                    <Mini items={[s.outer, s.top, s.bottom, s.shoes]} />
                    <span className="sug-names">
                      {[s.outer, s.top, s.bottom, s.shoes].filter((g): g is Garment => !!g).map((g) => <b key={g.id}>{g.name}</b>)}
                    </span>
                  </div>
                  <ul className="sug-why">
                    {s.reasons.map((r) => <li key={r}><Icon name="check" size={14} stroke={2.4} />{r}</li>)}
                  </ul>
                  <div className="sug-actions">
                    <button className="btn btn-outline" onClick={() => wear(s)}>입혀 보기</button>
                    <button className="btn btn-ghost" onClick={() => { setSel(suggestionSel(s)); askSave(`${season} ${situation} 코디`); }}>저장</button>
                  </div>
                </li>
              ))}
            </ul>
          ))}
        </>
      )}

      {tab === 'dress' && tray && (
        <Tray slot={tray} list={bySlot[tray]} selectedId={sel[tray]} onPick={(id) => choose(tray, id)} onFit={(g, fit) => g.photo && update(g.id, { photo: { ...g.photo, fit } })} onClose={() => setTray(null)} />
      )}

      <Sheet open={sheet === 'body'} onClose={() => setSheet(null)} title="신체 치수"
        footer={
          <div className="foot-row">
            {body && <button className="btn btn-ghost" onClick={() => { setBody(null); setSheet(null); toast('치수를 지웠어요'); }}>치수 삭제</button>}
            <button className="btn btn-primary" onClick={applyBody}>치수 적용</button>
          </div>
        }>
        <div className="fields">
          <p className="hint" style={{ margin: 0 }}>키만 있어도 돼요. 나머지는 비워 두면 키에 맞춘 평균 비율로 만들어요.</p>
          <div className="field-row">
            {BODY_KEYS.map((k) => (
              <label className="field" key={k}>
                <span>{BODY_LABEL[k]} (cm){k === 'height' && <i> *</i>}</span>
                <input inputMode="decimal" value={fields[k]} onChange={(e) => { setFields({ ...fields, [k]: e.target.value }); setErrors({ ...errors, [k]: undefined }); }}
                  placeholder={`${BODY_RANGE[k][0]}~${BODY_RANGE[k][1]}`} aria-invalid={!!errors[k]} />
                {errors[k] && <small className="field-error">{errors[k]}</small>}
              </label>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet open={sheet === 'save'} onClose={() => setSheet(null)} title="코디 저장"
        footer={<button className="btn btn-primary btn-block" disabled={!outfitName.trim()} onClick={doSave}>저장</button>}>
        <div className="fields">
          <div className="saving-preview"><Mini items={SLOTS.map((s) => worn[s]).filter((g) => g)} /><span>{wornList.map((g) => g.name).join(' + ')}</span></div>
          <label className="field"><span>코디 이름</span><input value={outfitName} onChange={(e) => setOutfitName(e.target.value)} placeholder="예: 출근 코디" autoFocus /></label>
        </div>
      </Sheet>
    </div>
  );
}
