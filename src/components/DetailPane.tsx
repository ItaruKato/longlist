import { useEffect, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { loadDetail, saveState, type Detail } from '../data/firestore';
import { EXCLUDE_LABEL, type ExcludeCode } from '../lib/exclude';
import { isExcluded } from '../lib/filter';
import { prtimesArticleUrl, prtimesCompanyUrl } from '../lib/csv';
import type { Row } from '../lib/rows';
import { STAGES, TEMPS, stageOf, type UserState } from '../lib/state';
import { yenLabel } from '../lib/yen';

type Data = Record<string, unknown>;

const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : v.toLocaleString('ja-JP'));
const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('ja-JP') : '');
const safeUrl = (u: unknown) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

export function DetailPane({
  db,
  row,
  state,
  onClose,
}: {
  db: Firestore;
  row: Row;
  state: UserState | undefined;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<'' | 'saving' | 'saved' | 'failed'>('');
  const [memo, setMemo] = useState(state?.memo ?? '');
  const [nextText, setNextText] = useState(state?.nextText ?? '');
  const [owner, setOwner] = useState(state?.owner ?? '');

  useEffect(() => {
    setDetail(null);
    setErr(null);
    setSaving('');
    let alive = true;
    loadDetail(db, row.id).then(
      (d) => alive && setDetail(d),
      (e) => alive && setErr(String((e as { code?: string }).code ?? e)),
    );
    return () => {
      alive = false;
    };
  }, [db, row.id]);
  // 別の会社に切り替えたら、書きかけの欄もその会社の内容にする
  useEffect(() => {
    setMemo(state?.memo ?? '');
    setNextText(state?.nextText ?? '');
    setOwner(state?.owner ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  const save = async (patch: Partial<UserState>) => {
    setSaving('saving');
    try {
      await saveState(db, row.id, patch);
      setSaving('saved');
    } catch {
      setSaving('failed');
    }
  };

  const c = (detail?.company ?? {}) as Data;
  const p = (c.profile ?? {}) as Data;
  const g = (c.gbiz ?? {}) as Data;
  const ins = c.gbizInsured as { total: number; offices: number; updated?: string } | undefined;
  const fin = c.gbizFinance as Data | undefined;
  const money = (k: string) => yenLabel(((fin?.[k] as Data | undefined)?.yen as number | undefined) ?? null);
  const phone = typeof p.phone === 'string' ? p.phone : '';
  const hp = safeUrl(p.url) ?? safeUrl(g.url);
  const excluded = isExcluded(row, state);

  return (
    <div className="detail">
      <div className="dhead">
        <button className="ghost back" type="button" onClick={onClose} aria-label="一覧に戻る">
          ← 一覧
        </button>
        <span className="savestate">{saving === 'saving' ? '保存中…' : saving === 'saved' ? '保存しました' : saving === 'failed' ? '保存できませんでした' : ''}</span>
      </div>
      <h2>{row.name}</h2>
      <div className="links">
        <a href={prtimesCompanyUrl(row.id)} target="_blank" rel="noopener noreferrer">PR TIMES</a>
        {hp && (
          <a href={hp} target="_blank" rel="noopener noreferrer">HP</a>
        )}
        {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>📞 {phone}</a>}
      </div>

      <section className="mine">
        <div className="field">
          <span>温度感</span>
          <div className="seg">
            {TEMPS.map((t) => (
              <button key={t} type="button" className={state?.temperature === t ? 'on' : ''} onClick={() => save({ temperature: state?.temperature === t ? null : t })}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>進捗</span>
          <div className="seg wrap">
            {STAGES.map((s) => (
              <button key={s} type="button" className={stageOf(state) === s ? 'on' : ''} onClick={() => save({ progress: s })}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>次にやること</span>
          <div className="row2">
            <input value={nextText} placeholder="例：電話で挨拶" onChange={(e) => setNextText(e.target.value)} onBlur={() => nextText !== (state?.nextText ?? '') && save({ nextText })} />
            <input type="date" value={state?.nextDate ?? ''} onChange={(e) => save({ nextDate: e.target.value })} />
          </div>
        </label>
        <label className="field">
          <span>担当</span>
          <input value={owner} placeholder="例：加藤" onChange={(e) => setOwner(e.target.value)} onBlur={() => owner !== (state?.owner ?? '') && save({ owner: owner.trim() })} />
        </label>
        <label className="field">
          <span>メモ</span>
          <textarea rows={4} value={memo} onChange={(e) => setMemo(e.target.value)} onBlur={() => memo !== (state?.memo ?? '') && save({ memo })} />
        </label>
      </section>

      {err && <p className="err">詳しい情報を読めませんでした（{err}）</p>}
      {!detail && !err && <p className="muted">読み込み中…</p>}
      {detail && (
        <>
          <section>
            <h3>会社の情報</h3>
            <dl className="info">
              {(
                [
                  ['代表者', String(p.representative ?? g.representative ?? '')],
                  ['所在地', String(p.address ?? g.location ?? '')],
                  ['業種', String(p.industry ?? '')],
                  ['資本金', yenLabel(row.capital) || String(p.capital ?? '')],
                  ['設立', String(p.established ?? g.established ?? '')],
                  ['上場', String(p.listed ?? '')],
                  ['法人番号', row.cn],
                  ['厚生年金の加入者数', ins ? `${n(ins.total)}人（${ins.offices}事業所${ins.updated ? `・${ins.updated}` : ''}）` : ''],
                  ['従業員数', row.employees !== null ? `${n(row.employees)}人` : ''],
                  [
                    '財務（有価証券報告書）',
                    fin
                      ? [String(fin.period ?? ''), money('sales') && `売上 ${money('sales')}`, money('netIncome') && `純利益 ${money('netIncome')}`, money('netAssets') && `純資産 ${money('netAssets')}`, money('totalAssets') && `総資産 ${money('totalAssets')}`]
                          .filter(Boolean)
                          .join(' / ')
                      : '',
                  ],
                  ['事業の概要', String(g.summary ?? '')],
                ] as [string, string][]
              )
                .filter(([, v]) => v && v !== 'undefined')
                .map(([k, v]) => (
                  <div key={k} className="kv">
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
            {(row.cn || ins || fin) && <p className="source">法人番号・加入者数・従業員数・財務・事業の概要：「Gビズインフォ」（経済産業省）をもとに作成</p>}
          </section>

          {detail.handoff.length > 0 && (
            <section>
              <h3>Watcher で読了にした記事（{detail.handoff.length}件）</h3>
              {detail.handoff.map((h) => (
                <div key={h.id} className="handoff">
                  <a href={prtimesArticleUrl(h.id)} target="_blank" rel="noopener noreferrer">
                    {'★'.repeat(h.stars)} {h.title}
                  </a>
                  <small>{date(h.readAt)}</small>
                  {h.summary && <p className="muted">{h.summary}</p>}
                  {h.memo && <p>{h.memo}</p>}
                </div>
              ))}
            </section>
          )}

          <section>
            <h3>PR TIMES の記事（{detail.articles.length}件）</h3>
            <ul className="articles">
              {detail.articles.slice(0, 50).map((a) => (
                <li key={a.id}>
                  <small>{date(a.at)}</small>
                  <a href={prtimesArticleUrl(a.id)} target="_blank" rel="noopener noreferrer">
                    {a.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className="exclude">
        {excluded ? (
          <>
            <p className="muted">
              一覧から外しています{row.ex && state?.exclude !== true ? `（自動の判定：${EXCLUDE_LABEL[row.ex as ExcludeCode] ?? row.ex}）` : '（手で外しました）'}
            </p>
            <button className="btn" type="button" onClick={() => save({ exclude: false })}>
              一覧に戻す
            </button>
          </>
        ) : (
          <button className="btn" type="button" onClick={() => save({ exclude: true })}>
            この会社を一覧から外す
          </button>
        )}
      </section>
    </div>
  );
}
