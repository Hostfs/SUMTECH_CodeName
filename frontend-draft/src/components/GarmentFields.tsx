import { CATEGORIES, type Category } from '../data/garments';
import { SEASONS, type Season } from '../lib/seasons';

export interface FieldValues {
  name: string;
  category: Category;
  color: string;
  brand: string;
  size: string;
  material: string;
  memo: string;
  seasons: Season[];
}

interface Props {
  value: FieldValues;
  onChange: (next: FieldValues) => void;
  error?: string;
}

/** 옷 등록·수정에서 같이 쓰는 입력 폼 (이름·종류·색상·브랜드·사이즈·소재·계절·메모) */
export function GarmentFields({ value, onChange, error }: Props) {
  const set = <K extends keyof FieldValues>(k: K, v: FieldValues[K]) => onChange({ ...value, [k]: v });
  const toggleSeason = (s: Season) =>
    set('seasons', value.seasons.includes(s) ? value.seasons.filter((x) => x !== s) : [...value.seasons, s]);

  return (
    <div className="fields">
      <label className="field">
        <span>옷 이름 <i>*</i></span>
        <input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="예: 차콜 롱코트" aria-invalid={!!error} aria-describedby={error ? 'name-error' : undefined} />
        {error && <small id="name-error" className="field-error">{error}</small>}
      </label>

      <div className="field">
        <span>종류</span>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button type="button" key={c} className="chip" data-on={value.category === c} onClick={() => set('category', c)} aria-pressed={value.category === c}>{c}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>계절</span>
        <div className="chips">
          {SEASONS.map((s) => (
            <button type="button" key={s} className="chip" data-on={value.seasons.includes(s)} onClick={() => toggleSeason(s)} aria-pressed={value.seasons.includes(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="field-row">
        <label className="field"><span>색상</span><input value={value.color} onChange={(e) => set('color', e.target.value)} placeholder="예: 차콜" /></label>
        <label className="field"><span>사이즈</span><input value={value.size} onChange={(e) => set('size', e.target.value)} placeholder="예: M" /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>브랜드</span><input value={value.brand} onChange={(e) => set('brand', e.target.value)} placeholder="미입력" /></label>
        <label className="field"><span>소재</span><input value={value.material} onChange={(e) => set('material', e.target.value)} placeholder="미입력" /></label>
      </div>
      <label className="field"><span>메모</span><input value={value.memo} onChange={(e) => set('memo', e.target.value)} placeholder="예: 한겨울 외출용" /></label>
    </div>
  );
}
