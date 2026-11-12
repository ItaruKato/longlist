import { CAP_BUCKETS, EMPTY_FILTERS, SIZE_BUCKETS, type Filters } from '../lib/filter';
import { REGIONS } from '../lib/region';
import { STAGES } from '../lib/state';
import { LEGAL_FORMS } from '../lib/legal';

export function FilterPanel({
  f,
  set,
  industries,
  owners,
  tagDefs,
}: {
  f: Filters;
  set: (f: Filters) => void;
  industries: string[];
  owners: string[];
  tagDefs: { code: string; label: string; group: string }[];
}) {
  const upd = <K extends keyof Filters>(k: K, v: Filters[K]) => set({ ...f, [k]: v });
  const prefs = f.region ? (REGIONS.find((r) => r.name === f.region)?.prefs ?? []) : REGIONS.flatMap((r) => r.prefs);
  return (
    <div className="filters">
      <label>
        <span>地方</span>
        <select value={f.region} onChange={(e) => set({ ...f, region: e.target.value, pref: '' })}>
          <option value="">すべて</option>
          {REGIONS.map((r) => (
            <option key={r.name}>{r.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>都道府県</span>
        <select value={f.pref} onChange={(e) => upd('pref', e.target.value)}>
          <option value="">すべて</option>
          {prefs.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label>
        <span>業界タグ（メインかサブ）</span>
        <select value={f.tag} onChange={(e) => upd('tag', e.target.value)}>
          <option value="">すべて</option>
          {[...new Set(tagDefs.map((t) => t.group))].map((g) => (
            <optgroup key={g} label={g}>
              {tagDefs
                .filter((t) => t.group === g)
                .map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
            </optgroup>
          ))}
          <option value="none">まだ付いていない</option>
        </select>
      </label>
      <label>
        <span>BtoB／BtoC</span>
        <select value={f.biz} onChange={(e) => upd('biz', e.target.value as Filters['biz'])}>
          <option value="">すべて</option>
          <option value="btob">BtoB（両方も含む）</option>
          <option value="btoc">BtoC（両方も含む）</option>
          <option value="both">両方</option>
          <option value="none">まだ付いていない</option>
        </select>
      </label>
      <label>
        <span>PR TIMES の業種</span>
        <select value={f.industry} onChange={(e) => upd('industry', e.target.value)}>
          <option value="">すべて</option>
          {industries.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label>
        <span>法人格</span>
        <select value={f.form} onChange={(e) => upd('form', e.target.value)}>
          <option value="">すべて</option>
          {LEGAL_FORMS.map((x) => (
            <option key={x.code} value={x.code}>
              {x.label}
            </option>
          ))}
          <option value="none">不明</option>
        </select>
      </label>
      <label>
        <span>人数（厚生年金の加入者数）</span>
        <select value={f.size} onChange={(e) => upd('size', e.target.value)}>
          <option value="">すべて</option>
          {SIZE_BUCKETS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>資本金</span>
        <select value={f.cap} onChange={(e) => upd('cap', e.target.value)}>
          <option value="">すべて</option>
          {CAP_BUCKETS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>上場</span>
        <select value={f.listed} onChange={(e) => upd('listed', e.target.value as Filters['listed'])}>
          <option value="">すべて</option>
          <option value="listed">上場</option>
          <option value="unlisted">未上場</option>
        </select>
      </label>
      <label>
        <span>最新の記事</span>
        <select value={f.recent} onChange={(e) => upd('recent', e.target.value as Filters['recent'])}>
          <option value="">いつでも</option>
          <option value="30">30日以内</option>
          <option value="90">90日以内</option>
          <option value="365">1年以内</option>
        </select>
      </label>
      <label>
        <span>温度感</span>
        <select value={f.temp} onChange={(e) => upd('temp', e.target.value as Filters['temp'])}>
          <option value="">すべて</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
          <option value="none">未設定</option>
        </select>
      </label>
      <label>
        <span>進捗</span>
        <select value={f.stage} onChange={(e) => upd('stage', e.target.value)}>
          <option value="">すべて</option>
          {STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        <span>担当</span>
        <select value={f.owner} onChange={(e) => upd('owner', e.target.value)}>
          <option value="">すべて</option>
          {owners.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={f.hasNext} onChange={(e) => upd('hasNext', e.target.checked)} />
        <span>次にやることがある会社だけ</span>
      </label>
      <button className="btn" type="button" onClick={() => set({ ...EMPTY_FILTERS, view: f.view, q: f.q })}>
        絞り込みを消す
      </button>
    </div>
  );
}
