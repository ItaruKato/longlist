import { useEffect, useMemo, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import {
  loadAnswers,
  loadTagDefs,
  loadTrial,
  MODEL_LABEL,
  requestTrialModel,
  setVerdict,
  startTrial,
  type ModelKey,
  type TagAnswer,
  type TagDef,
  type Trial,
  type Verdict,
} from '../data/firestore';
import { displayName, type Row } from '../lib/rows';
import type { UserState } from '../lib/state';
import { pickSample, summarize } from '../lib/trial';

const TRIAL_ID = 't1';
const SIZE = 200;
const MODELS: ModelKey[] = ['sonnet', 'haiku', 'opus'];
const BIZ: Record<string, string> = { btob: 'BtoB', btoc: 'BtoC', both: 'BtoB・BtoC' };
const CONF: Record<string, string> = { high: '確か', mid: 'だいたい', low: '迷い' };
const VERDICTS: { v: Verdict; label: string; title: string }[] = [
  { v: 'ok', label: '○', title: '合っている' },
  { v: 'partial', label: '△', title: 'だいたい合っている（メインは合っているがサブが違う など）' },
  { v: 'ng', label: '×', title: '違う' },
];

/** 業界タグのお試し：同じ200社に AI ごとのタグを付け、本人が ○△× を付けて比べる */
export function TrialPage({ db, rows, states, onOpen, selected }: { db: Firestore; rows: Row[]; states: Map<string, UserState>; onOpen: (id: string) => void; selected: string | null }) {
  const [trial, setTrial] = useState<Trial | null | undefined>(undefined);
  const [defs, setDefs] = useState<TagDef[]>([]);
  const [answers, setAnswers] = useState<Map<string, Partial<Record<ModelKey, TagAnswer>> & { error?: string }>>(new Map());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const label = useMemo(() => new Map(defs.map((d) => [d.code, d.label])), [defs]);
  const fail = (e: unknown) => setErr(String((e as { code?: string }).code ?? e));

  // お試しの内容と AI の答えを読む（開いたとき・ボタンのあと・答えが出そろうまで30秒ごと）
  useEffect(() => {
    let alive = true;
    (async () => {
      const t = await loadTrial(db, TRIAL_ID);
      if (!alive) return;
      setTrial(t);
      if (t?.ids.length) {
        const a = await loadAnswers(db, t.ids);
        if (alive) setAnswers(a);
      }
      const d = await loadTagDefs(db);
      if (alive) setDefs(d);
    })().catch(fail);
    return () => {
      alive = false;
    };
  }, [db, tick]);
  const ids = trial?.ids ?? [];
  const requested = trial?.requested ?? [];
  const pending = ids.length > 0 && requested.some((m) => ids.some((id) => !answers.get(id)?.[m] && !answers.get(id)?.error));
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [pending]);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await f();
      setTick((n) => n + 1);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  /** ○△× はすぐ画面に出してから保存する（読み直しは待たない） */
  const judge = (id: string, m: ModelKey, v: Verdict | null) => {
    setTrial((t) => {
      if (!t) return t;
      const cur = { ...(t.verdicts?.[id] ?? {}) };
      if (v) cur[m] = v;
      else delete cur[m];
      return { ...t, verdicts: { ...(t.verdicts ?? {}), [id]: cur } };
    });
    setVerdict(db, TRIAL_ID, id, m, v).catch(fail);
  };
  const tags = (a: TagAnswer) => [a.main, ...a.subs].map((c, i) => (i === 0 ? label.get(c) ?? c : `＋${label.get(c) ?? c}`)).join(' ');

  if (trial === undefined) return <p className="muted pad">読み込み中…</p>;
  if (trial === null)
    return (
      <div className="pad trialstart">
        <h2>業界タグのお試し</h2>
        <p>
          除外していない・直近1年に記事がある会社から、くじ引きで{SIZE}社を選び、まず Sonnet に業界タグを付けてもらいます（費用は2ドルくらい）。
          答えが出たら（30分〜1時間ほど）、1社ずつ ○△× を付けてください。同じ{SIZE}社で Haiku・Opus も試して比べられます。
        </p>
        <button className="btn primary" type="button" disabled={busy || !rows.length} onClick={() => run(() => startTrial(db, TRIAL_ID, pickSample(rows, states, SIZE), 'sonnet'))}>
          Sonnet で{SIZE}社を試す
        </button>
        {err && <p className="err">{err}</p>}
      </div>
    );

  return (
    <div className="trial">
      <div className="trialhead">
        <b>業界タグのお試し（{ids.length}社）</b>
        <div className="trialsum">
          {MODELS.map((m) => {
            const s = summarize(ids, answers, trial.verdicts, m);
            if (!requested.includes(m))
              return (
                <button key={m} className="btn" type="button" disabled={busy} onClick={() => run(() => requestTrialModel(db, TRIAL_ID, ids, m))}>
                  {MODEL_LABEL[m]} でも試す
                </button>
              );
            return (
              <span key={m} className="sum">
                <b>{MODEL_LABEL[m]}</b> 答え {s.done}/{ids.length}・見直し {s.judged}（○{s.ok} △{s.partial} ×{s.ng}
                {s.judged ? `・○の割合 ${Math.round((s.ok / s.judged) * 100)}%` : ''}）・迷い {s.low}
              </span>
            );
          })}
          <button className="ghost" type="button" onClick={() => setTick((n) => n + 1)}>
            読み直す
          </button>
        </div>
        {err && <p className="err">{err}</p>}
      </div>
      <div className="triallist">
        {ids.map((id) => {
          const r = byId.get(id);
          const a = answers.get(id);
          return (
            <div key={id} className={`tcard${selected === id ? ' sel' : ''}`}>
              <button type="button" className="tname" onClick={() => onOpen(id)} title="押すと詳しい情報（記事など）を出す">
                {r ? displayName(r) : id}
                {r?.industry && <small>（PR TIMES の業種：{r.industry}）</small>}
              </button>
              {a?.error && <p className="err">{a.error}</p>}
              {requested.map((m) => {
                const x = a?.[m];
                const v = trial.verdicts?.[id]?.[m];
                return (
                  <div key={m} className="tans">
                    <span className="tm">{MODEL_LABEL[m]}</span>
                    {x ? (
                      <>
                        <span className="tt">
                          <b>{tags(x)}</b> <span className="muted">{BIZ[x.biz] ?? x.biz}・{CONF[x.confidence] ?? x.confidence}</span>
                          <br />
                          <span className="muted">{x.reason}</span>
                        </span>
                        <span className="seg">
                          {VERDICTS.map((o) => (
                            <button key={o.v} type="button" title={o.title} className={v === o.v ? 'on' : ''} onClick={() => judge(id, m, v === o.v ? null : o.v)}>
                              {o.label}
                            </button>
                          ))}
                        </span>
                      </>
                    ) : (
                      <span className="muted">待ち</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
