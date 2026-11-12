import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { loadContacts, loadIndex, watchStates, type IndexMeta } from '../data/firestore';
import { applyFilters, EMPTY_FILTERS, headcount, sortRows, SORTS, type Filters, type SortKey } from '../lib/filter';
import { toCsv } from '../lib/csv';
import type { Row } from '../lib/rows';
import { stageOf, type UserState } from '../lib/state';
import { yenLabel } from '../lib/yen';
import { FilterPanel } from './FilterPanel';
import { DetailPane } from './DetailPane';
import { VirtualList } from './VirtualList';

const KEY = 'longlist.view.v1';
function loadView(): { f: Filters; sort: SortKey } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v?.f) return { f: { ...EMPTY_FILTERS, ...v.f }, sort: v.sort ?? 'last' };
  } catch {
    /* 保存できない端末では毎回はじめから */
  }
  return { f: EMPTY_FILTERS, sort: 'last' };
}
function saveView(v: { f: Filters; sort: SortKey }) {
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
  const setSort = (s: SortKey) => {
    const v = { ...view, sort: s };
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
  const shown = useMemo(() => sortRows(applyFilters(all, states, { ...f, q }, today), states, view.sort), [all, states, f, q, today, view.sort]);
  const excludedCount = useMemo(() => applyFilters(all, states, { ...EMPTY_FILTERS, view: 'excluded' }, today).length, [all, states, today]);
  const selRow = sel ? all.find((r) => r.id === sel) : undefined;
  const resetKey = JSON.stringify([f, view.sort]);

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
        <span className="name">{r.name}</span>
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
          {r.name}
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
            <span>会社名</span>
            <span className="c-ind">業界</span>
            <span>都道府県</span>
            <span className="num">人数</span>
            <span className="num">資本金</span>
            <span className="c-listed">上場</span>
            <span className="num">最新記事</span>
            <span className="num">1年</span>
            <span>温度</span>
            <span>進捗</span>
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
          <select value={view.sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="並び順">
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
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
