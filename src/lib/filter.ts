import { displayName, type Row } from './rows';
import { regionOf } from './region';
import { PREFS } from './pref';
import { stageOf, type UserState } from './state';

export interface Filters {
  view: 'list' | 'excluded';
  q: string;
  region: string;
  pref: string;
  industry: string;
  /** 法人格（legal.ts の code。'none' は不明） */
  form: string;
  size: string;
  cap: string;
  listed: '' | 'listed' | 'unlisted';
  recent: '' | '30' | '90' | '365';
  temp: '' | 'A' | 'B' | 'C' | 'none';
  stage: string;
  owner: string;
  hasNext: boolean;
}

export const EMPTY_FILTERS: Filters = {
  view: 'list',
  q: '',
  region: '',
  pref: '',
  industry: '',
  form: '',
  size: '',
  cap: '',
  listed: '',
  recent: '',
  temp: '',
  stage: '',
  owner: '',
  hasNext: false,
};

export type SortKey = 'last' | 'n1y' | 'capital' | 'size' | 'next' | 'temp' | 'name' | 'industry' | 'pref' | 'listed' | 'progress';
export type SortDir = 'asc' | 'desc';
export const SORTS: { key: SortKey; label: string; dir: SortDir }[] = [
  { key: 'last', label: '最新記事', dir: 'desc' },
  { key: 'n1y', label: '記事の数（1年）', dir: 'desc' },
  { key: 'capital', label: '資本金', dir: 'desc' },
  { key: 'size', label: '人数', dir: 'desc' },
  { key: 'next', label: '次にやる日', dir: 'asc' },
  { key: 'temp', label: '温度感', dir: 'asc' },
  { key: 'progress', label: '進捗', dir: 'asc' },
  { key: 'name', label: '会社名', dir: 'asc' },
  { key: 'industry', label: '業界', dir: 'asc' },
  { key: 'pref', label: '都道府県（北から）', dir: 'asc' },
  { key: 'listed', label: '上場', dir: 'desc' },
];
export const defaultDir = (k: SortKey): SortDir => SORTS.find((s) => s.key === k)?.dir ?? 'desc';

/** 人数の目安：厚生年金の被保険者数。なければ gBizINFO の従業員数 */
export const headcount = (r: Row) => r.insured ?? r.employees;

export const SIZE_BUCKETS: { key: string; label: string; test: (n: number | null) => boolean }[] = [
  { key: 's10', label: '〜10人', test: (n) => n !== null && n <= 10 },
  { key: 's50', label: '11〜50人', test: (n) => n !== null && n > 10 && n <= 50 },
  { key: 's300', label: '51〜300人', test: (n) => n !== null && n > 50 && n <= 300 },
  { key: 's1000', label: '301〜1000人', test: (n) => n !== null && n > 300 && n <= 1000 },
  { key: 'sbig', label: '1001人〜', test: (n) => n !== null && n > 1000 },
  { key: 'snone', label: '人数不明', test: (n) => n === null },
];

export const CAP_BUCKETS: { key: string; label: string; test: (n: number | null) => boolean }[] = [
  { key: 'c1', label: '〜1,000万円', test: (n) => n !== null && n <= 1e7 },
  { key: 'c5', label: '〜5,000万円', test: (n) => n !== null && n > 1e7 && n <= 5e7 },
  { key: 'c10', label: '〜1億円', test: (n) => n !== null && n > 5e7 && n <= 1e8 },
  { key: 'c100', label: '〜10億円', test: (n) => n !== null && n > 1e8 && n <= 1e9 },
  { key: 'cbig', label: '10億円〜', test: (n) => n !== null && n > 1e9 },
  { key: 'cnone', label: '資本金不明', test: (n) => n === null },
];

export function isExcluded(r: Row, s: UserState | undefined): boolean {
  if (s?.exclude === true) return true;
  if (s?.exclude === false) return false;
  return r.ex !== '';
}

const daysAgo = (today: string, n: number) => {
  const t = new Date(`${today}T00:00:00Z`).getTime() - n * 86400e3;
  return new Date(t).toISOString().slice(0, 10);
};

const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');

export function applyFilters(rows: Row[], states: Map<string, UserState>, f: Filters, today: string): Row[] {
  const q = norm(f.q);
  const size = SIZE_BUCKETS.find((b) => b.key === f.size);
  const cap = CAP_BUCKETS.find((b) => b.key === f.cap);
  const since = f.recent ? daysAgo(today, Number(f.recent)) : '';
  return rows.filter((r) => {
    const s = states.get(r.id);
    if (isExcluded(r, s) !== (f.view === 'excluded')) return false;
    if (q && !norm(r.name).includes(q) && !(r.official && norm(r.official).includes(q))) return false;
    if (f.pref ? r.pref !== f.pref : f.region && regionOf(r.pref) !== f.region) return false;
    if (f.industry && r.industry !== f.industry) return false;
    if (f.form && (f.form === 'none' ? r.form !== '' : r.form !== f.form)) return false;
    if (size && !size.test(headcount(r))) return false;
    if (cap && !cap.test(r.capital)) return false;
    if (f.listed === 'listed' && r.listed !== 2) return false;
    if (f.listed === 'unlisted' && r.listed !== 1) return false;
    if (since && (!r.last || r.last < since)) return false;
    if (f.temp === 'none' ? s?.temperature : f.temp && s?.temperature !== f.temp) return false;
    if (f.stage && stageOf(s) !== f.stage) return false;
    if (f.owner && (s?.owner ?? '') !== f.owner) return false;
    if (f.hasNext && !s?.nextDate && !s?.nextText) return false;
    return true;
  });
}

const LEGAL_FORM = /株式会社|有限会社|合同会社|合名会社|合資会社|\((株|有|同)\)/g;
const TEMP_RANK: Record<string, number> = { A: 0, B: 1, C: 2 };
/** 進捗の並び：動いている会社が先（受注 → 商談 → アプローチ中 → 未着手 → 対象外） */
const PROGRESS_RANK: Record<string, number> = { 受注: 0, 商談: 1, アプローチ中: 2, 未着手: 3, 対象外: 4 };

/** 並べ替え。空の値（人数不明など）は、向きに関係なく最後に置く */
export function sortRows(rows: Row[], states: Map<string, UserState>, key: SortKey, dir: SortDir = defaultDir(key)): Row[] {
  const value = (r: Row): number | string | null => {
    const s = states.get(r.id);
    switch (key) {
      case 'last':
        return r.last || null;
      case 'n1y':
        return r.n1y;
      case 'capital':
        return r.capital;
      case 'size':
        return headcount(r);
      case 'next':
        return s?.nextDate || null;
      case 'temp':
        return s?.temperature ? TEMP_RANK[s.temperature] : null;
      case 'progress':
        return PROGRESS_RANK[stageOf(s)];
      case 'name':
        // 「株式会社」などを除いた名前で並べる
        return displayName(r).normalize('NFKC').replace(LEGAL_FORM, '').trim() || displayName(r) || null;
      case 'industry':
        return r.industry || null;
      case 'pref': {
        const i = PREFS.indexOf(r.pref as (typeof PREFS)[number]);
        return i >= 0 ? i : null;
      }
      case 'listed':
        return r.listed || null;
    }
  };
  const sign = dir === 'asc' ? 1 : -1;
  const keyed = rows.map((r) => ({ r, v: value(r) }));
  keyed.sort((a, b) => {
    if (a.v === null || b.v === null) {
      if (a.v !== b.v) return a.v === null ? 1 : -1;
    } else if (a.v !== b.v) {
      const c = typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : String(a.v).localeCompare(String(b.v), 'ja');
      if (c) return c * sign;
    }
    // 同じ値のときは、最新記事が新しい順
    return a.r.last === b.r.last ? 0 : a.r.last < b.r.last ? 1 : -1;
  });
  return keyed.map((x) => x.r);
}
