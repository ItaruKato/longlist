import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { articleStats, packRows, rowOf } from '../src/build';
import { fromTuple, type Row } from '../../src/lib/rows';

describe('rowOf', () => {
  it('台帳の1件から一覧の1行を作る', () => {
    const r = rowOf('123', {
      name: '株式会社テスト',
      corporateNumber: '1234567890123',
      profile: { industry: '情報通信', address: '東京都渋谷区道玄坂1-1', capital: '1億円', listed: '未上場' },
      gbiz: { capital: 120000000, employees: 30 },
      gbizInsured: { total: 28 },
      gbizFinance: { sales: { raw: '1,000', unit: '百万円', yen: 1e9 } },
    });
    expect(r).toEqual({
      id: '123',
      name: '株式会社テスト',
      industry: '情報通信',
      pref: '東京都',
      capital: 120000000,
      insured: 28,
      listed: 1,
      last: '',
      n1y: 0,
      ex: '',
      cn: '1234567890123',
      employees: 30,
      sales: 1e9,
    });
  });
  it('企業情報がまだの会社・除外する会社', () => {
    expect(rowOf('1', { name: '株式会社まだ' })).toMatchObject({ pref: '', capital: null, insured: null, listed: 0, ex: '' });
    expect(rowOf('2', { name: '一般社団法人テスト協会', profile: { capital: '-' } })).toMatchObject({ ex: 'assoc', capital: null });
    // gBizINFO の資本金がなければ PR TIMES の企業情報の資本金を読む
    expect(rowOf('3', { name: '株式会社B', profile: { capital: '3,000万円' } }).capital).toBe(30000000);
  });
});

describe('articleStats', () => {
  it('最新の日付（日本時間）と直近1年の数', () => {
    const now = new Date('2026-11-12T00:00:00Z').getTime();
    const a = {
      'x.1': { t: 'a', p: '2026-11-11T23:30:00+09:00' },
      'x.2': { t: 'b', p: '2026-01-05T10:00:00+09:00' },
      'x.3': { t: 'c', p: '2025-11-01T10:00:00+09:00' },
      'x.4': { t: 'd' },
    };
    expect(articleStats(a, now)).toEqual({ last: '2026-11-11', n1y: 2 });
    expect(articleStats(undefined, now)).toEqual({ last: '', n1y: 0 });
  });
});

describe('packRows', () => {
  it('上限を超えないように分け、元に戻せる', () => {
    const rows: Row[] = Array.from({ length: 3000 }, (_, i) => ({
      id: String(i),
      name: `株式会社テスト${i}${'あ'.repeat(i % 7)}`,
      industry: '情報通信',
      pref: '東京都',
      capital: i * 1000,
      insured: i,
      listed: 1,
      last: '2026-11-01',
      n1y: i % 5,
      ex: '',
      cn: String(1e12 + i),
      employees: null,
      sales: null,
    }));
    const chunks = packRows(rows, 8000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(8000);
    const back = chunks.flatMap((c) => (JSON.parse(gunzipSync(c).toString()) as unknown[][]).map(fromTuple));
    expect(back).toEqual(rows);
  });
});
