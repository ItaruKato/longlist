import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { loadContacts, loadIndex, watchStates, type IndexMeta } from '../data/firestore';
import { applyFilters, defaultDir, EMPTY_FILTERS, headcount, sortRows, SORTS, type Filters, type SortDir, type SortKey, type SortSpec } from '../lib/filter';
import { toCsv } from '../lib/csv';
import { displayName, type Row } from '../lib/rows';
import { stageOf, type UserState } from '../lib/state';
import { yenLabel } from '../lib/yen';
import { FilterPanel } from './FilterPanel';
import { DetailPane } from './DetailPane';
import { VirtualList } from './VirtualList';

const KEY = 'longlist.view.v1';
interface View {
  f: Filters;
  sort: SortKey;
  dir: SortDir;
  /** 同じ値のときの2番目の並べ替え（なしは null） */
  then: SortSpec | null;
}
const isKey = (k: unknown): k is SortKey => SORTS.some((s) => s.key === k);
function loadView(): View {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v?.f && isKey(v.sort))
      return {
        f: { ...EMPTY_FILTERS, ...v.f },
        sort: v.sort,
        dir: v.dir === 'asc' || v.dir === 'desc' ? v.dir : defaultDir(v.sort),
        then: v.then && isKey(v.then.key) ? { key: v.then.key, dir: v.then.dir === 'asc' ? 'asc' : 'desc' } : null,
      };
  } catch {
    /* 保存できない端末では毎回はじめから */
  }
  return { f: EMPTY_FILTERS, sort: 'last', dir: 'desc', then: null };
}
function saveView(v: View) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* 無視 */
  }
}

function useWide() {
  const q = '(min-width: 1000px)';
  const [wide, setWide] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

const todayJst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const LISTED = ['', '未上場', '上場'];
/** 表の列（見出しを押すと、その列で並べ替え） */
const COLUMNS: { key: SortKey; label: string; cls: string }[] = [
  { key: 'name', label: '会社名', cls: '' },
  { key: 'industry', label: '業界', cls: 'c-ind' },
  { key: 'pref', label: '都道府県', cls: '' },
  { key: 'size', label: '人数', cls: 'num' },
  { key: 'capital', label: '資本金', cls: 'num' },
  { key: 'listed', label: '上場', cls: 'c-listed' },
  { key: 'last', label: '最新記事', cls: 'num' },
  { key: 'n1y', label: '1年', cls: 'num' },
  { key: 'temp', label: '温度', cls: '' },
  { key: 'progress', label: '進捗', cls: '' },
];
const short = (d: string) => (d ? d.slice(2).replace(/-/g, '/') : '');

export function ListPage({ db, onSignOut }: { db: Firestore; onSignOut: () => void }) {
  const wide = useWide();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<IndexMeta | null>(null);
  const [states, setStates] = useState<Map<string, UserState>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState(loadView);
  const [sel, setSel] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [csv, setCsv] = useState<string | null>(null);
  const f = view.f;
  const setF = (nf: Filters) => {
    const v = { ...view, f: nf };
    setView(v);
    saveView(v);
  };
  /** 並べ替え：別の列なら決まった向き、同じ列なら向きを逆にする */
  const setSort = (s: SortKey, dir?: SortDir) => {
    const d: SortDir = dir ?? (view.sort === s ? (view.dir === 'asc' ? 'desc' : 'asc') : defaultDir(s));
    // 2番目と同じ列を1番目にしたら、2番目はなしにする
    const v: View = { ...view, sort: s, dir: d, then: view.then?.key === s ? null : view.then };
    setView(v);
    saveView(v);
  };
  /** 2番目の並べ替え：別の列なら決まった向き、同じ列なら向きを逆にする。null でなし */
  const setThen = (s: SortKey | null, dir?: SortDir) => {
    const then: SortSpec | null =
      s === null || s === view.sort ? null : { key: s, dir: dir ?? (view.then?.key === s ? (view.then.dir === 'asc' ? 'desc' : 'asc') : defaultDir(s)) };
    const v: View = { ...view, then };
    setView(v);
    saveView(v);
  };

  useEffect(() => {
    loadIndex(db).then(
      (r) => {
        setRows(r.rows);
        setMeta(r.meta);
      },
      (e) => setErr(String((e as { code?: string }).code ?? e)),
    );
    return watchStates(db, setStates, (e) => setErr(String((e as { code?: string }).code ?? e)));
  }, [db]);

  const q = useDeferredValue(f.q);
  const today = todayJst();
  const all = useMemo(() => rows ?? [], [rows]);
  const industries = useMemo(() => [...new Set(all.map((r) => r.industry).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')), [all]);
  const owners = useMemo(() => [...new Set([...states.values()].map((s) => s.owner).filter((o): o is string => Boolean(o)))].sort(), [states]);
  const shown = useMemo(() => sortRows(applyFilters(all, states, { ...f, q }, today), states, view.sort, view.dir, view.then), [all, states, f, q, today, view.sort, view.dir, view.then]);
  const excludedCount = useMemo(() => applyFilters(all, states, { ...EMPTY_FILTERS, view: 'excluded' }, today).length, [all, states, today]);
  const selRow = sel ? all.find((r) => r.id === sel) : undefined;
  const resetKey = JSON.stringify([f, view.sort, view.dir, view.then]);

  const exportCsv = async () => {
    if (!shown.length) return;
    if (shown.length > 5000 && !confirm(`${shown.length.toLocaleString()}社を書き出します。代表者・電話を読むのに少し時間がかかります。続けますか？`)) return;
    try {
      setCsv('0');
      const contacts = await loadContacts(db, shown.map((r) => r.id), (n) => setCsv(String(n)));
      const blob = new Blob([toCsv(shown, states, contacts)], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `longlist-${today}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (e) {
      setErr(`CSV を作れませんでした（${String((e as { code?: string }).code ?? e)}）`);
    } finally {
      setCsv(null);
    }
  };

  const tempOf = (id: string) => states.get(id)?.temperature ?? '';
  const renderTableRow = (r: Row) => {
    const s = states.get(r.id);
    return (
      <button type="button" className={`trow${sel === r.id ? ' sel' : ''}`} onClick={() => setSel(r.id)}>
        <span className="name" title={r.official ? `PR TIMES での名前：${r.name}` : undefined}>
          {displayName(r)}
        </span>
        <span className="c-ind">{r.industry}</span>
        <span>{r.pref}</span>
        <span className="num">{headcount(r) !== null ? `${headcount(r)!.toLocaleString()}人` : ''}</span>
        <span className="num">{yenLabel(r.capital)}</span>
        <span className="c-listed">{LISTED[r.listed]}</span>
        <span className="num">{short(r.last)}</span>
        <span className="num">{r.n1y || ''}</span>
        <span className={`temp t${tempOf(r.id)}`}>{tempOf(r.id)}</span>
        <span>{stageOf(s) === '未着手' ? '' : stageOf(s)}</span>
      </button>
    );
  };
  const renderCard = (r: Row) => {
    const s = states.get(r.id);
    const hc = headcount(r);
    return (
      <button type="button" className="ccard" onClick={() => setSel(r.id)}>
        <span className="cname">
          {tempOf(r.id) && <b className={`temp t${tempOf(r.id)}`}>{tempOf(r.id)}</b>}
          {displayName(r)}
        </span>
        <span className="cmeta">{[r.industry, r.pref, hc !== null ? `${hc.toLocaleString()}人` : '', yenLabel(r.capital), LISTED[r.listed]].filter(Boolean).join(' · ')}</span>
        <span className="cmeta">
          {r.last ? `最新 ${short(r.last)}・1年 ${r.n1y}件` : '記事なし'}
          {stageOf(s) !== '未着手' ? `・${stageOf(s)}` : ''}
          {s?.nextDate ? `・次 ${short(s.nextDate)}` : ''}
        </span>
      </button>
    );
  };

  const list =
    rows === null ? (
      <p className="muted pad">{err ? `一覧を読めませんでした（${err}）` : '一覧を読み込み中…'}</p>
    ) : !meta ? (
      <p className="muted pad">一覧のまとめをまだ作っていません。自動で作られるまでお待ちください（最大6時間）。</p>
    ) : shown.length === 0 ? (
      <p className="muted pad">条件に合う会社がありません。</p>
    ) : wide ? (
      <VirtualList
        items={shown}
        rowHeight={40}
        render={renderTableRow}
        resetKey={resetKey}
        headerHeight={32}
        header={
          <div className="thead">
            {COLUMNS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`${c.cls}${view.sort === c.key ? ' on' : view.then?.key === c.key ? ' on2' : ''}`}
                aria-sort={view.sort === c.key ? (view.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                title="押すと並べ替え（もう一度押すと逆の順）。Shift を押しながらだと、同じ値のときの2番目の並べ替え"
                onClick={(e) => (e.shiftKey ? setThen(c.key) : setSort(c.key))}
              >
                {c.label}
                {view.sort === c.key && <i>{view.dir === 'asc' ? '▲' : '▼'}</i>}
                {view.then?.key === c.key && <i>2{view.then.dir === 'asc' ? '▲' : '▼'}</i>}
              </button>
            ))}
          </div>
        }
      />
    ) : (
      <VirtualList items={shown} rowHeight={86} render={renderCard} resetKey={resetKey} className="cards" />
    );

  return (
    <div className={`app${wide ? ' wide' : ''}`}>
      <header className="top">
        <div className="toprow">
          <b className="brand">Long List</b>
          <div className="tabs">
            <button type="button" className={f.view === 'list' ? 'on' : ''} onClick={() => setF({ ...f, view: 'list' })}>
              一覧
            </button>
            <button type="button" className={f.view === 'excluded' ? 'on' : ''} onClick={() => setF({ ...f, view: 'excluded' })}>
              除外 {excludedCount ? excludedCount.toLocaleString() : ''}
            </button>
          </div>
          <button className="ghost" type="button" onClick={onSignOut}>
            ログアウト
          </button>
        </div>
        <div className="toprow">
          <input className="search" type="search" placeholder="会社名で探す" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          {!wide && (
            <button className="btn" type="button" onClick={() => setShowFilters(true)}>
              絞り込み
            </button>
          )}
        </div>
        <div className="toprow">
          <span className="count">{rows ? `${shown.length.toLocaleString()}社` : ''}</span>
          <select value={view.sort} onChange={(e) => setSort(e.target.value as SortKey, defaultDir(e.target.value as SortKey))} aria-label="並び順">
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}の順
              </option>
            ))}
          </select>
          <button className="btn dir" type="button" onClick={() => setSort(view.sort, view.dir === 'asc' ? 'desc' : 'asc')} aria-label="並びの向きを逆にする" title="並びの向きを逆にする">
            {view.dir === 'asc' ? '▲' : '▼'}
          </button>
          <span className="then">
            <span className="muted">次に</span>
            <select value={view.then?.key ?? ''} onChange={(e) => setThen(e.target.value ? (e.target.value as SortKey) : null, e.target.value ? defaultDir(e.target.value as SortKey) : undefined)} aria-label="同じ値のときの並び順">
              <option value="">なし</option>
              {SORTS.filter((s) => s.key !== view.sort).map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            {view.then && (
              <button className="btn dir" type="button" onClick={() => setThen(view.then!.key, view.then!.dir === 'asc' ? 'desc' : 'asc')} aria-label="2番目の並びの向きを逆にする">
                {view.then.dir === 'asc' ? '▲' : '▼'}
              </button>
            )}
          </span>
          <button className="btn" type="button" disabled={csv !== null || !shown.length} onClick={exportCsv}>
            {csv !== null ? `書き出し中 ${Number(csv).toLocaleString()}/${shown.length.toLocaleString()}` : 'CSV'}
          </button>
        </div>
        {err && rows && <p className="err">{err}</p>}
      </header>
      {wide && (
        <aside className="side">
          <FilterPanel f={f} set={setF} industries={industries} owners={owners} />
          <p className="foot">
            {meta ? `まとめ：${new Date(meta.builtAt).toLocaleString('ja-JP')}` : ''}
            <br />
            法人番号・加入者数などの出典：「
            <a href="https://info.gbiz.go.jp/" target="_blank" rel="noopener noreferrer">
              Gビズインフォ
            </a>
            」（経済産業省）をもとに作成
          </p>
        </aside>
      )}
      <main className="list">{list}</main>
      {wide ? (
        <section className="pane">{selRow ? <DetailPane db={db} row={selRow} state={states.get(selRow.id)} onClose={() => setSel(null)} /> : <p className="muted pad">会社を選ぶと、ここに詳しい情報が出ます。</p>}</section>
      ) : (
        selRow && (
          <div className="sheet">
            <DetailPane db={db} row={selRow} state={states.get(selRow.id)} onClose={() => setSel(null)} />
          </div>
        )
      )}
      {!wide && showFilters && (
        <div className="sheet">
          <div className="dhead">
            <button className="ghost back" type="button" onClick={() => setShowFilters(false)}>
              ← {shown.length.toLocaleString()}社を見る
            </button>
          </div>
          <FilterPanel f={f} set={setF} industries={industries} owners={owners} />
        </div>
      )}
    </div>
  );
}
