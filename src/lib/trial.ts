import type { Row } from './rows';
import { isExcluded } from './filter';
import type { UserState } from './state';

/** お試しの会社を選ぶ：除外していない・直近1年に記事がある会社から、くじ引きで n 社 */
export function pickSample(rows: Row[], states: Map<string, UserState>, n: number, rand: () => number = Math.random): string[] {
  const pool = rows.filter((r) => !isExcluded(r, states.get(r.id)) && r.n1y >= 1).map((r) => r.id);
  // フィッシャー–イェーツで前から n 個
  for (let i = 0; i < Math.min(n, pool.length); i++) {
    const j = i + Math.floor(rand() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export interface TrialSummary {
  done: number;
  ok: number;
  partial: number;
  ng: number;
  judged: number;
  low: number;
}

/** AI ごとのまとめ（答えが出た数・○△×・確かさが低い数） */
export function summarize(
  ids: string[],
  answers: Map<string, object>,
  verdicts: Record<string, Record<string, string | undefined> | undefined> | undefined,
  model: string,
): TrialSummary {
  const s: TrialSummary = { done: 0, ok: 0, partial: 0, ng: 0, judged: 0, low: 0 };
  for (const id of ids) {
    const a = (answers.get(id) as Record<string, { confidence?: string } | undefined> | undefined)?.[model];
    if (!a) continue;
    s.done++;
    if (a.confidence === 'low') s.low++;
    const v = verdicts?.[id]?.[model];
    if (v === 'ok' || v === 'partial' || v === 'ng') {
      s[v]++;
      s.judged++;
    }
  }
  return s;
}

export type Agreement = 'same' | 'split' | 'low' | 'waiting';

/**
 * AI どうしの答えの分かれ方（メインのタグで比べる）。
 * split：メインが分かれた、low：同じだがどれかが「迷い」、same：全部同じで迷いなし、waiting：答えがそろっていない
 */
export function agreementOf(answer: object | undefined, models: string[]): Agreement {
  const a = (answer ?? {}) as Record<string, { main?: string; confidence?: string } | undefined>;
  const xs = models.map((m) => a[m]);
  if (!models.length || xs.some((x) => !x?.main)) return 'waiting';
  if (new Set(xs.map((x) => x!.main)).size > 1) return 'split';
  return xs.some((x) => x!.confidence === 'low') ? 'low' : 'same';
}

