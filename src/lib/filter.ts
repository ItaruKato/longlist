import type { Row } from './rows';
import { regionOf } from './region';
import { stageOf, type UserState } from './state';

export interface Filters {
  view: 'list' | 'excluded';
  q: string;
  region: string;
  pref: string;
  industry: string;
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
  size: '',
  cap: '',
  listed: '',
  recent: '',
  temp: '',
  stage: '',
  owner: '',
  hasNext: false,
};

export type SortKey = 'last' | 'n1y' | 'capital' | 'size' | 'next' | 'temp' | 'name';
export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'last', label: '最新記事が新しい順' },
  { key: 'n1y', label: '記事が多い順' },
  { key: 'capital', label: '資本金が大きい順' },
  { key: 'size', label: '人数が多い順' },
  { key: 'next', label: '次にやる日が近い順' },
  { key: 'temp', label: '温度感の順' },
  { key: 'name', label: '会社名の順' },
];

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
    if (q && !norm(r.name).includes(q)) return false;
    if (f.pref ? r.pref !== f.pref : f.region && regionOf(r.pref) !== f.region) return false;
    if (f.industry && r.industry !== f.industry) return false;
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

const TEMP_ORDER: Record<string, number> = { A: 0, B: 1, C: 2 };
const desc = (a: number | null, b: number | null) => (b ?? -1) - (a ?? -1);

export function sortRows(rows: Row[], states: Map<string, UserState>, key: SortKey): Row[] {
  const byLast = (a: Row, b: Row) => (a.last === b.last ? 0 : a.last < b.last ? 1 : -1);
  const cmp: Record<SortKey, (a: Row, b: Row) => number> = {
    last: byLast,
    n1y: (a, b) => b.n1y - a.n1y || byLast(a, b),
    capital: (a, b) => desc(a.capital, b.capital) || byLast(a, b),
    size: (a, b) => desc(headcount(a), headcount(b)) || byLast(a, b),
    next: (a, b) => {
      const x = states.get(a.id)?.nextDate || '9999';
      const y = states.get(b.id)?.nextDate || '9999';
      return x.localeCompare(y) || byLast(a, b);
    },
    temp: (a, b) => (TEMP_ORDER[states.get(a.id)?.temperature ?? ''] ?? 3) - (TEMP_ORDER[states.get(b.id)?.temperature ?? ''] ?? 3) || byLast(a, b),
    name: (a, b) => a.name.localeCompare(b.name, 'ja'),
  };
  return [...rows].sort(cmp[key]);
}
