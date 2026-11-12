import { describe, expect, it } from 'vitest';
import { applyFilters, EMPTY_FILTERS, sortRows } from './filter';
import { toCsv } from './csv';
import type { Row } from './rows';
import type { UserState } from './state';

const row = (id: string, p: Partial<Row> = {}): Row => ({
  id, name: `株式会社${id}`, industry: '情報通信', pref: '東京都', capital: null, insured: null, listed: 1, last: '2026-11-01', n1y: 1, ex: '', cn: '', employees: null, sales: null, ...p,
});
const today = '2026-11-12';

describe('applyFilters', () => {
  const rows = [
    row('1', { pref: '大阪府', insured: 40, capital: 3e7 }),
    row('2', { ex: 'assoc', name: '一般社団法人テスト' }),
    row('3', { last: '2026-06-01', insured: 2000, listed: 2 }),
    row('4', { industry: '小売', employees: 8 }),
  ];
  const states = new Map<string, UserState>([
    ['1', { temperature: 'A', progress: '商談', owner: '加藤', nextDate: '2026-11-20' }],
    ['4', { exclude: true }],
  ]);
  const ids = (f: Partial<typeof EMPTY_FILTERS>) => applyFilters(rows, states, { ...EMPTY_FILTERS, ...f }, today).map((r) => r.id);

  it('除外した会社は別の画面', () => {
    expect(ids({})).toEqual(['1', '3']);
    expect(ids({ view: 'excluded' })).toEqual(['2', '4']);
    // 自動で除外された会社を戻す
    expect(applyFilters(rows, new Map([['2', { exclude: false }]]), EMPTY_FILTERS, today).map((r) => r.id)).toEqual(['1', '2', '3', '4']);
  });
  it('地域・規模・上場・最新記事・温度感・進捗・担当', () => {
    expect(ids({ region: '近畿' })).toEqual(['1']);
    expect(ids({ pref: '東京都' })).toEqual(['3']);
    expect(ids({ size: 's50' })).toEqual(['1']);
    expect(ids({ size: 'sbig' })).toEqual(['3']);
    expect(ids({ cap: 'c5' })).toEqual(['1']);
    expect(ids({ listed: 'listed' })).toEqual(['3']);
    expect(ids({ recent: '30' })).toEqual(['1']);
    expect(ids({ temp: 'A' })).toEqual(['1']);
    expect(ids({ temp: 'none' })).toEqual(['3']);
    expect(ids({ stage: '未着手' })).toEqual(['3']);
    expect(ids({ owner: '加藤' })).toEqual(['1']);
    expect(ids({ hasNext: true })).toEqual(['1']);
    expect(ids({ q: '株式会社3' })).toEqual(['3']);
  });
});

describe('sortRows', () => {
  it('並べ替え', () => {
    const rows = [row('1', { last: '2026-10-01', n1y: 9 }), row('2', { last: '2026-11-10', capital: 5e8 }), row('3', { last: '2026-09-01' })];
    const states = new Map<string, UserState>([['3', { temperature: 'A', nextDate: '2026-11-13' }]]);
    expect(sortRows(rows, states, 'last').map((r) => r.id)).toEqual(['2', '1', '3']);
    expect(sortRows(rows, states, 'n1y').map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(sortRows(rows, states, 'capital').map((r) => r.id)).toEqual(['2', '1', '3']);
    expect(sortRows(rows, states, 'temp').map((r) => r.id)).toEqual(['3', '2', '1']);
    expect(sortRows(rows, states, 'next').map((r) => r.id)).toEqual(['3', '2', '1']);
  });
});

describe('toCsv', () => {
  it('Excel で開ける CSV', () => {
    const csv = toCsv([row('1', { name: '株式会社"A",B', capital: 1e7 })], new Map([['1', { memo: '1行目\n2行目' }]]), new Map([['1', { phone: '03-0000-0000' }]]));
    expect(csv.startsWith('﻿会社名,')).toBe(true);
    expect(csv).toContain('"株式会社""A"",B"');
    expect(csv).toContain('"1行目\n2行目"');
    expect(csv).toContain('03-0000-0000');
    expect(csv).toContain('https://prtimes.jp/main/html/searchrlp/company_id/1');
    expect(csv).toContain('Gビズインフォ');
  });
});
