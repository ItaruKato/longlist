import { describe, expect, it } from 'vitest';
import { agreementOf, pickSample, summarize } from './trial';
import type { Row } from './rows';

const row = (id: string, p: Partial<Row> = {}): Row => ({
  id, name: id, industry: '', pref: '', capital: null, insured: null, listed: 0, last: '', n1y: 1, ex: '', cn: '', employees: null, sales: null, official: '', form: '', ...p,
});

describe('pickSample', () => {
  it('除外・記事なしは選ばず、重ならずに n 社', () => {
    const rows = [...Array.from({ length: 50 }, (_, i) => row(String(i))), row('ex', { ex: 'assoc' }), row('none', { n1y: 0 })];
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ids = pickSample(rows, new Map([['3', { exclude: true }]]), 20, rand);
    expect(ids.length).toBe(20);
    expect(new Set(ids).size).toBe(20);
    expect(ids).not.toContain('ex');
    expect(ids).not.toContain('none');
    expect(ids).not.toContain('3');
    expect(pickSample(rows, new Map(), 999).length).toBe(50);
  });
});

describe('summarize', () => {
  it('AI ごとの数', () => {
    const answers = new Map<string, Record<string, { confidence?: string }>>([
      ['1', { sonnet: { confidence: 'high' }, haiku: { confidence: 'low' } }],
      ['2', { sonnet: { confidence: 'low' } }],
    ]);
    const v = { '1': { sonnet: 'ok', haiku: 'ng' }, '2': { sonnet: 'partial' } };
    expect(summarize(['1', '2', '3'], answers, v, 'sonnet')).toEqual({ done: 2, ok: 1, partial: 1, ng: 0, judged: 2, low: 1 });
    expect(summarize(['1', '2', '3'], answers, v, 'haiku')).toEqual({ done: 1, ok: 0, partial: 0, ng: 1, judged: 1, low: 1 });
  });
});

describe('agreementOf', () => {
  it('メインのタグの分かれ方', () => {
    const m = ['sonnet', 'haiku', 'opus'];
    expect(agreementOf({ sonnet: { main: 'saas' }, haiku: { main: 'saas' }, opus: { main: 'saas' } }, m)).toBe('same');
    expect(agreementOf({ sonnet: { main: 'saas' }, haiku: { main: 'si' }, opus: { main: 'saas' } }, m)).toBe('split');
    expect(agreementOf({ sonnet: { main: 'saas', confidence: 'low' }, haiku: { main: 'saas' }, opus: { main: 'saas' } }, m)).toBe('low');
    expect(agreementOf({ sonnet: { main: 'saas' }, haiku: { main: 'saas' } }, m)).toBe('waiting');
    expect(agreementOf(undefined, m)).toBe('waiting');
  });
});
