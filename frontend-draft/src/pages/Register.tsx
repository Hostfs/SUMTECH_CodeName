import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { GarmentArt } from '../components/GarmentArt';
import { GarmentFields, type FieldValues } from '../components/GarmentFields';
import { LocationSheet } from '../components/LocationSheet';
import { FitEditor } from '../components/FitEditor';
import { Sheet } from '../components/Sheet';
import { Studio2D } from '../components/Studio2D';
import { useGarments } from '../data/store';
import { useImages } from '../data/images';
import { useOutfits } from '../data/outfits';
import { colorHex, fmtLoc, type Category, type Garment, type Loc, type Photo, type Shape } from '../data/garments';
import { cutOut, loadCanvas, nearestColorName, type CutMode, type Cutout, type PhotoKind, type Points } from '../lib/cutout';
import { DEFAULT_FIT, type Fit } from '../lib/fit';
import { NotConnected, fetchImage, lookupProduct, reconstructWithAI, type ProductHit } from '../lib/importImage';
import { useToast } from '../lib/toast';

const KIND_OF: Record<Category, PhotoKind> = { 상의: 'top', 아우터: 'outer', 하의: 'bottom', 신발: 'shoes', 기타: 'top' };
const SHAPES: Record<Category, [Shape, string][]> = {
  상의: [['tee', '티셔츠'], ['knit', '니트'], ['shirt', '셔츠']],
  아우터: [['blazer', '재킷'], ['coat', '코트'], ['puffer', '패딩']],
  하의: [['pants', '바지'], ['shorts', '반바지'], ['skirt', '스커트'], ['pleated', '플리츠']],
  신발: [['sneaker', '스니커즈'], ['loafer', '로퍼'], ['boots', '부츠']],
  기타: [['tee', '기타']],
};
const WARMTH: Partial<Record<Shape, number>> = { tee: 1, shirt: 2, knit: 4, blazer: 3, coat: 4, puffer: 5, pants: 2, shorts: 1, skirt: 2, pleated: 2, sneaker: 0, loafer: 0, boots: 0 };
const EMPTY: FieldValues = { name: '', category: '상의', color: '', brand: '', size: '', material: '', memo: '', seasons: [] };

/** 이름의 단어로 세부 종류를 짐작한다 */
function guessShape(cat: Category, name: string): Shape {
  const has = (re: RegExp) => re.test(name);
  if (cat === '상의') return has(/니트|스웨터|맨투맨|가디건|헨리넥/) ? 'knit' : has(/셔츠|블라우스/) ? 'shirt' : has(/티|반팔/) ? 'tee' : 'tee';
  if (cat === '아우터') return has(/코트|트렌치/) ? 'coat' : has(/패딩|다운|점퍼/) ? 'puffer' : 'blazer';
  if (cat === '하의') return has(/반바지|숏/) ? 'shorts' : has(/플리츠/) ? 'pleated' : has(/스커트|치마/) ? 'skirt' : 'pants';
  if (cat === '신발') return has(/로퍼/) ? 'loafer' : has(/부츠/) ? 'boots' : 'sneaker';
  return 'tee';
}

/** 등록을 시작하기 전에 먼저 고르는 옷 종류. 종류에 따라 누끼·기준점 찾는 방식이 달라진다 */
const KINDS: { cat: Category; shape: Shape; desc: string }[] = [
  { cat: '상의', shape: 'knit', desc: '티·니트·셔츠' },
  { cat: '아우터', shape: 'coat', desc: '코트·재킷·패딩' },
  { cat: '하의', shape: 'pants', desc: '바지·스커트' },
  { cat: '신발', shape: 'sneaker', desc: '스니커즈·부츠' },
];

type Stage = 'choose' | 'busy' | 'review';
type Panel = 'code' | 'url' | null;

function Method({ icon, title, desc, onClick, main, wide, on, disabled }: { icon: IconName; title: string; desc: string; onClick: () => void; main?: boolean; wide?: boolean; on?: boolean; disabled?: boolean }) {
  return (
    <button className="method" data-main={main} data-wide={wide} data-on={on} disabled={disabled} onClick={onClick}>
      <span className="method-ico"><Icon name={icon} size={22} /></span>
      <b>{title}</b>
      <small>{desc}</small>
    </button>
  );
}

export default function Register() {
  const nav = useNavigate();
  const toast = useToast();
  const { add } = useGarments();
  const images = useImages();
  const { body } = useOutfits();
  const fileInput = useRef<HTMLInputElement>(null);
  const tagInput = useRef<HTMLInputElement>(null);

  const [picked, setPicked] = useState<Category | null>(null);
  const [stage, setStage] = useState<Stage>('choose');
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [source, setSource] = useState<Photo['source'] | null>(null);

  const [raw, setRaw] = useState<HTMLCanvasElement | null>(null);
  const [cut, setCut] = useState<Cutout | null>(null);
  const [cutUrl, setCutUrl] = useState('');
  const [points, setPoints] = useState<Points>({});
  const [fit, setFit] = useState<Fit>(DEFAULT_FIT);
  const [mode, setMode] = useState<'auto' | CutMode>('auto');
  const [tol, setTol] = useState(36);

  const [fields, setFields] = useState<FieldValues>(EMPTY);
  const [shape, setShape] = useState<Shape>('tee');
  const [shapeTouched, setShapeTouched] = useState(false);
  const [nameError, setNameError] = useState('');
  const [loc, setLoc] = useState<Loc | null>(null);
  const [sheet, setSheet] = useState<'loc' | 'recut' | null>(null);

  const [urlText, setUrlText] = useState('');
  const [brand, setBrand] = useState('');
  const [code, setCode] = useState('');
  const [hits, setHits] = useState<ProductHit[] | null>(null);
  const [tags, setTags] = useState<{ url: string; name: string }[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const kind = KIND_OF[fields.category];

  // 누끼 결과를 화면용 주소로 (입혀 보기 미리보기와 편집기가 쓴다)
  useEffect(() => {
    if (!cut) {
      setCutUrl('');
      return;
    }
    let alive = true;
    cut.canvas.toBlob((b) => {
      if (!b || !alive) return;
      const u = URL.createObjectURL(b);
      setCutUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return u;
      });
    });
    return () => {
      alive = false;
    };
  }, [cut]);

  const run = async (canvas: HTMLCanvasElement, o: { kind: PhotoKind; mode?: 'auto' | CutMode; tolerance?: number }) => {
    setStage('busy');
    setError('');
    try {
      // 종류는 사용자가 먼저 골랐으므로 사진으로 짐작하지 않는다. 신발은 흰색 등 배경과 비슷한 색이 많아 안쪽 영역을 지우지 않는다.
      const tolerance = o.kind === 'shoes' ? Math.min(o.tolerance ?? 8, 12) : o.tolerance;
      const r = await cutOut(canvas, { ...o, tolerance, holes: o.kind !== 'shoes', onProgress: setBusy });
      setCut(r);
      setPoints(r.points);
      setFit(DEFAULT_FIT);
      setFields((f) => ({ ...f, color: f.color || nearestColorName(r.hex) }));
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진을 처리하지 못했어요');
      setStage(cut ? 'review' : 'choose');
    }
  };

  const pick = (cat: Category) => {
    setPicked(cat);
    setFields((f) => ({ ...f, category: cat }));
    if (!shapeTouched) setShape(guessShape(cat, fields.name));
    setPanel(null);
    setError('');
  };

  const begin = async (src: Blob | string, from: Photo['source'], cat: Category | null = picked) => {
    if (!cat) return setError('먼저 어떤 종류의 옷인지 골라 주세요');
    if (cat !== picked) pick(cat);
    setStage('busy');
    setBusy('사진을 불러오는 중이에요');
    setError('');
    try {
      const blob = typeof src === 'string' && from !== 'sample' ? await fetchImage(src) : src;
      const canvas = await loadCanvas(blob);
      setRaw(canvas);
      setSource(from);
      await run(canvas, { kind: KIND_OF[cat], mode: 'auto' });
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진을 불러오지 못했어요');
      setStage('choose');
    }
  };

  const onFile = (f?: File | null) => {
    if (!f) return;
    if (!picked) return setError('먼저 어떤 종류의 옷인지 골라 주세요');
    if (!f.type.startsWith('image/')) return setError('이미지 파일만 올릴 수 있어요');
    if (f.size > 10 * 1024 * 1024) return setError('한 장당 10MB 이하만 올릴 수 있어요');
    void begin(f, 'upload');
  };

  const onFields = (next: FieldValues) => {
    if (next.category !== fields.category) {
      if (!shapeTouched) setShape(guessShape(next.category, next.name));
      if (raw && cut) void run(raw, { kind: KIND_OF[next.category], mode, tolerance: tol });
    } else if (!shapeTouched && next.name !== fields.name) {
      setShape(guessShape(next.category, next.name));
    }
    setFields(next);
    setNameError('');
  };

  const find = async () => {
    setNote('');
    setHits(null);
    if (!code.trim()) return setNote('제품 코드(품번)를 입력해 주세요');
    try {
      const r = await lookupProduct(brand.trim(), code.trim());
      setHits(r);
      if (!r.length) setNote('같은 코드의 사진을 찾지 못했어요. 상품 페이지의 이미지 주소를 붙여 넣거나, 사진을 직접 올려 주세요.');
    } catch (e) {
      setNote(e instanceof NotConnected
        ? '인터넷 상품 검색은 서버(R02)가 연결돼야 해요. 지금은 상품 페이지의 이미지 주소를 붙여 넣거나 사진을 직접 올리면, 아래와 같은 방식으로 누끼를 따서 정리해 드려요.'
        : '검색하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    }
  };

  const aiRedraw = async () => {
    if (!cut) return;
    const png = await new Promise<Blob | null>((r) => cut.canvas.toBlob(r, 'image/png'));
    if (!png) return;
    setBusy('AI가 깨끗한 상품 사진으로 다시 그리는 중이에요');
    setStage('busy');
    try {
      const out = await reconstructWithAI(png);
      const canvas = await loadCanvas(out);
      setCut({ ...cut, canvas });
      toast('AI가 다시 그린 사진으로 바꿨어요');
    } catch (e) {
      toast(e instanceof NotConnected ? 'AI 다시 그리기는 서버의 AI 연결이 필요해요. 지금은 사진의 실제 픽셀을 그대로 써요' : '다시 그리지 못했어요');
    } finally {
      setStage('review');
    }
  };

  const save = async () => {
    if (!fields.name.trim()) {
      setNameError('옷 이름을 입력해 주세요');
      return;
    }
    setSaving(true);
    try {
      let photo: Photo | undefined;
      if (cut) {
        const png = await new Promise<Blob | null>((r) => cut.canvas.toBlob(r, 'image/png'));
        if (png) photo = { src: await images.save(png), w: cut.canvas.width, h: cut.canvas.height, kind, points, fit, source: source ?? 'upload' };
      }
      const g = add({
        name: fields.name.trim(),
        category: fields.category,
        shape,
        color: fields.color.trim(),
        hex: cut?.hex ?? colorHex(fields.color),
        seasons: fields.seasons,
        loc,
        brand: fields.brand.trim() || undefined,
        size: fields.size.trim() || undefined,
        material: fields.material.trim() || undefined,
        memo: fields.memo.trim() || undefined,
        warmth: WARMTH[shape] ?? 2,
        photo,
      });
      toast('옷을 등록했어요');
      nav(`/closet/${g.id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const draft: Garment | null =
    cut && cutUrl
      ? {
          id: 'draft', name: fields.name || '새 옷', category: fields.category, shape, color: fields.color, hex: cut.hex, seasons: [], loc: null, warmth: 2, createdAt: 0,
          photo: { src: cutUrl, w: cut.canvas.width, h: cut.canvas.height, kind, points, fit, source: source ?? 'upload' },
        }
      : null;

  const reset = () => {
    setStage('choose');
    setCut(null);
    setRaw(null);
    setError('');
    setPanel(null);
  };

  return (
    <div className="page pinned register">
      <div className="pin">
        <header className="topbar">
          <button className="icon-btn" onClick={() => (stage === 'review' ? reset() : nav(-1))} aria-label="뒤로"><Icon name="chevronLeft" size={24} /></button>
          <h1>옷 등록</h1>
          <span className="topbar-gap" />
        </header>
      </div>

      {error && <p className="notice warn" role="alert"><Icon name="alert" size={16} />{error}</p>}

      {stage === 'choose' && (
        <>
          <div className="reg-intro">
            <h2>어떤 옷을 등록할까요?</h2>
            <p>종류를 먼저 고르면, 그에 맞게 배경을 지우고 마네킹에 맞춰 드려요.</p>
          </div>

          <div className="kinds" role="radiogroup" aria-label="옷 종류">
            {KINDS.map((k) => (
              <button key={k.cat} className="kind" role="radio" aria-checked={picked === k.cat} data-on={picked === k.cat} onClick={() => pick(k.cat)}>
                <span className="kind-art"><GarmentArt shape={k.shape} hex={picked === k.cat ? '#C9A57B' : '#D8D2C6'} size={46} /></span>
                <b>{k.cat}</b>
                <small>{k.desc}</small>
              </button>
            ))}
          </div>

          <div className="reg-step" data-locked={!picked}>
            <h3>어떻게 등록할까요?</h3>
            {!picked && <p className="hint">위에서 종류를 먼저 골라 주세요.</p>}
            <div className="methods">
              <Method main icon="camera" title="옷 사진" desc="찍거나 앨범에서 골라요" disabled={!picked} on={false} onClick={() => fileInput.current?.click()} />
              <Method main icon="tag" title="택·제품 코드" desc="품번으로 상품 사진을 찾아요" disabled={!picked} on={panel === 'code'} onClick={() => setPanel(panel === 'code' ? null : 'code')} />
              <Method icon="link" title="사진 주소" desc="쇼핑몰 이미지 주소" disabled={!picked} on={panel === 'url'} onClick={() => setPanel(panel === 'url' ? null : 'url')} />
              <Method icon="edit" title="사진 없이" desc="이름·종류만 적어요" disabled={!picked} onClick={() => { setStage('review'); setSource(null); setCut(null); }} />
            </div>
          </div>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

          {panel === 'url' && (
            <section className="panel">
              <label className="field"><span>이미지 주소</span>
                <input value={urlText} onChange={(e) => setUrlText(e.target.value)} placeholder="https://… (사진을 길게 눌러 ‘이미지 주소 복사’)" inputMode="url" />
              </label>
              <button className="btn btn-primary btn-block" disabled={!urlText.trim()} onClick={() => void begin(urlText, 'url')}>가져와서 정리하기</button>
              <p className="fine">상품 사진은 사람이 입은 사진이어도 괜찮아요. 입은 옷만 골라내고 신발·맨살은 빼요.</p>
            </section>
          )}

          {panel === 'code' && (
            <section className="panel">
              <p className="hint" style={{ margin: 0 }}>택에 적힌 브랜드와 품번으로 같은 상품의 사진을 찾아요. 보세·개인 제작 옷은 찾지 못할 수 있어요. 그럴 땐 ‘옷 사진’으로 직접 올려 주세요.</p>
              <div className="field-row">
                <label className="field"><span>브랜드</span><input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="예: SUARE" /></label>
                <label className="field"><span>제품 코드(품번)</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="택에 적힌 품번" /></label>
              </div>
              <div className="field">
                <span>택 사진 (선택)</span>
                <div className="photo-row">
                  {tags.map((t) => <div key={t.url} className="photo"><img src={t.url} alt={t.name} /></div>)}
                  <button className="photo add" onClick={() => tagInput.current?.click()} aria-label="택 사진 추가"><Icon name="camera" size={22} /><span>택 사진</span></button>
                </div>
                <input ref={tagInput} type="file" accept="image/*" multiple hidden onChange={(e) => { Array.from(e.target.files ?? []).slice(0, 4).forEach((f) => setTags((t) => [...t, { url: URL.createObjectURL(f), name: f.name }].slice(0, 4))); e.target.value = ''; }} />
                <small className="muted-text">택 사진의 글자 읽기는 서버가 연결되면 품번을 자동으로 채워 줘요.</small>
              </div>
              <button className="btn btn-primary btn-block" onClick={() => void find()}><Icon name="search" size={16} /> 사진 찾기</button>
              {note && <p className="notice"><Icon name="alert" size={16} />{note}</p>}
              {hits && hits.length > 0 && (
                <ul className="hits">
                  {hits.map((h) => (
                    <li key={h.imageUrl}>
                      <button onClick={() => void begin(h.imageUrl, 'code')}><img src={h.imageUrl} alt="" /><span><b>{h.title}</b><small>{h.source}</small></span></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className="samples">
            <span>예시 사진으로 먼저 해 볼래요?</span>
            <button className="link-btn" onClick={() => void begin('/samples/source-cargo-pants.png', 'sample', '하의')}>사람이 입은 바지</button>
            <button className="link-btn" onClick={() => void begin('/samples/source-henley-knit.png', 'sample', '상의')}>상품 니트</button>
            <button className="link-btn" onClick={() => void begin('/samples/source-air-force-1.png', 'sample', '신발')}>흰 운동화</button>
          </div>
        </>
      )}

      {stage === 'busy' && (
        <div className="busy" role="status">
          <i className="spin big" />
          <b>{busy || '정리하는 중이에요'}</b>
          <small>처음에는 옷 분할 모델을 내려받느라 조금 걸려요</small>
        </div>
      )}

      {stage === 'review' && (
        <>
          {cut && (
            <>
              <section className="cut-card">
                <div className="checker"><img src={cutUrl} alt="누끼 딴 옷" /></div>
                <div className="cut-meta">
                  <span className="tag"><Icon name="check" size={13} stroke={2.6} /> {cut.mode === 'person' ? '입은 옷만 골랐어요' : '배경을 지웠어요'}</span>
                  <button className="link-btn" onClick={() => setSheet('recut')}>다시 오리기</button>
                </div>
              </section>

              {kind !== 'shoes' && (
                <section className="reg-block">
                  <h3>핏 맞추기</h3>
                  <p className="hint">점을 끌어 {kind === 'bottom' ? '허리 양끝과 밑단' : '목·어깨 끝·소매 끝'} 위치에 맞춰 주세요. 마네킹 어깨선 각도에 맞춰 입혀져요.</p>
                  {cutUrl && <FitEditor src={cutUrl} w={cut.canvas.width} h={cut.canvas.height} kind={kind} points={points} onChange={setPoints} />}
                </section>
              )}

              <section className="reg-block">
                <h3>입혀 보기</h3>
                <div className="mini-stage">
                  {draft && (
                    <Studio2D body={body} top={kind === 'top' ? draft : null} outer={kind === 'outer' ? draft : null} bottom={kind === 'bottom' ? draft : null} shoes={kind === 'shoes' ? draft : null} />
                  )}
                </div>
                <div className="fit-row page-fit">
                  <label>품<input type="range" min="0.8" max="1.3" step="0.02" value={fit.width} onChange={(e) => setFit({ ...fit, width: Number(e.target.value) })} /></label>
                  {kind !== 'shoes' && <label>기장<input type="range" min="0.8" max="1.25" step="0.02" value={fit.length} onChange={(e) => setFit({ ...fit, length: Number(e.target.value) })} /></label>}
                </div>
                <button className="btn btn-outline ai-btn" onClick={() => void aiRedraw()}><Icon name="sparkle" size={14} /> AI로 깔끔하게 다시 그리기</button>
                <p className="fine">사진의 실제 픽셀을 그대로 써서 없는 디테일이 생기지 않아요. AI 다시 그리기는 서버의 AI 연결 후에 쓸 수 있고, 쓰기 전에 원본과 비교해 고를 수 있게 둘 예정이에요.</p>
              </section>
            </>
          )}

          <section className="reg-block">
            <h3>옷 정보</h3>
            <GarmentFields value={fields} onChange={onFields} error={nameError} />
            <div className="field" style={{ marginTop: 16 }}>
              <span>세부 종류 <small className="muted-text">(추천·일러스트에 쓰여요)</small></span>
              <div className="chips">
                {SHAPES[fields.category].map(([s, label]) => (
                  <button key={s} className="chip" data-on={shape === s} onClick={() => { setShape(s); setShapeTouched(true); }} aria-pressed={shape === s}>{label}</button>
                ))}
              </div>
            </div>
            <button className="loc-pick" onClick={() => setSheet('loc')}>
              <Icon name="pin" size={18} />
              <span>{loc ? fmtLoc(loc, ' › ') : '보관 위치는 나중에 정할게요'}</span>
              <Icon name="chevronRight" size={18} />
            </button>
          </section>

          <div className="action-bar single">
            <button className="btn btn-primary btn-block" disabled={saving} onClick={() => void save()}>{saving ? '저장하는 중…' : '저장하기'}</button>
          </div>
        </>
      )}

      <LocationSheet open={sheet === 'loc'} onClose={() => setSheet(null)} count={1} current={loc} onSubmit={(l) => { setLoc(l); setSheet(null); }} />

      <Sheet open={sheet === 'recut'} onClose={() => setSheet(null)} title="다시 오리기"
        footer={<button className="btn btn-primary btn-block" onClick={() => { setSheet(null); if (raw) void run(raw, { kind: KIND_OF[fields.category], mode, tolerance: tol }); }}>이 설정으로 다시 오리기</button>}>
        <div className="fields">
          <div className="field">
            <span>사진 종류</span>
            <div className="chips">
              {([['auto', '자동'], ['flat', '옷만 있는 사진'], ['person', '사람이 입은 사진']] as const).map(([m, label]) => (
                <button key={m} className="chip" data-on={mode === m} onClick={() => setMode(m)} aria-pressed={mode === m}>{label}</button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>배경 지우는 강도 <small className="muted-text">(옷만 있는 사진)</small></span>
            <input type="range" min="18" max="70" step="2" value={tol} onChange={(e) => setTol(Number(e.target.value))} style={{ accentColor: 'var(--accent)' }} />
            <small className="muted-text">높을수록 배경과 비슷한 색까지 지워요. 옷 색이 배경과 비슷하면 낮춰 보세요. (신발은 흰색이 많아 약하게만 지워요)</small>
          </label>
        </div>
      </Sheet>
    </div>
  );
}
