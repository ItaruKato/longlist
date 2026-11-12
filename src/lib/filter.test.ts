import { describe, expect, it } from 'vitest';
import { applyFilters, EMPTY_FILTERS, sortRows } from './filter';
import { toCsv } from './csv';
import type { Row } from './rows';
import type { UserState } from './state';

const row = (id: string, p: Partial<Row> = {}): Row => ({
  id, name: `株式会社${id}`, industry: '情報通信', pref: '東京都', capital: null, insured: null, listed: 1, last: '2026-11-01', n1y: 1, ex: '', cn: '', employees: null, sales: null, official: '', form: 'kk', ...p,
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
    expect(ids({ form: 'kk' })).toEqual(['1', '3']);
    expect(ids({ form: 'none' })).toEqual([]);
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
  it('正式な名前でも探せる', () => {
    const rows = [row('1', { name: 'ワン', official: '株式会社ワン' }), row('2', { name: 'アイ合同会社' })];
    expect(applyFilters(rows, new Map(), { ...EMPTY_FILTERS, q: '株式会社ワン' }, today).map((r) => r.id)).toEqual(['1']);
    expect(applyFilters(rows, new Map(), { ...EMPTY_FILTERS, q: 'ワン' }, today).map((r) => r.id)).toEqual(['1']);
  });
  it('2番目の並べ替え：同じ値のときに使う', () => {
    const rows = [
      row('1', { pref: '大阪府', insured: 10 }),
      row('2', { pref: '東京都', insured: 50 }),
      row('3', { pref: '大阪府', insured: 300 }),
      row('4', { pref: '東京都', insured: null }),
      row('5', { pref: '東京都', insured: 5 }),
    ];
    const none = new Map<string, UserState>();
    expect(sortRows(rows, none, 'pref', 'asc', { key: 'size', dir: 'desc' }).map((r) => r.id)).toEqual(['2', '5', '4', '3', '1']);
    expect(sortRows(rows, none, 'pref', 'asc', { key: 'size', dir: 'asc' }).map((r) => r.id)).toEqual(['5', '2', '4', '1', '3']);
    // 1番目と同じ列を選んでも壊れない
    expect(sortRows(rows, none, 'size', 'desc', { key: 'size', dir: 'asc' }).map((r) => r.id)).toEqual(['3', '2', '1', '5', '4']);
  });
  it('会社名は株式会社などを除いて並べる', () => {
    const rows = [row('1', { name: '株式会社ワン' }), row('2', { name: 'アイ合同会社' }), row('3', { name: '有限会社かきく' })];
    expect(sortRows(rows, new Map(), 'name').map((r) => r.id)).toEqual(['2', '3', '1']);
  });
  it('逆向きにしても、空の値は最後', () => {
    const rows = [row('1', { capital: 1e7 }), row('2', { capital: null }), row('3', { capital: 5e8 })];
    const none = new Map<string, UserState>();
    expect(sortRows(rows, none, 'capital', 'desc').map((r) => r.id)).toEqual(['3', '1', '2']);
    expect(sortRows(rows, none, 'capital', 'asc').map((r) => r.id)).toEqual(['1', '3', '2']);
    const p = [row('1', { pref: '沖縄県' }), row('2', { pref: '' }), row('3', { pref: '北海道' })];
    expect(sortRows(p, none, 'pref').map((r) => r.id)).toEqual(['3', '1', '2']);
    expect(sortRows(p, none, 'pref', 'desc').map((r) => r.id)).toEqual(['1', '3', '2']);
    const st = new Map<string, UserState>([['1', { progress: '商談' }], ['3', { progress: '対象外' }]]);
    expect(sortRows(p, st, 'progress').map((r) => r.id)).toEqual(['1', '2', '3']);
  });
});

describe('toCsv', () => {
  it('Excel で開ける CSV', () => {
    const csv = toCsv([row('1', { name: '株式会社"A",B', capital: 1e7 })], new Map([['1', { memo: '1行目\n2行目' }]]), new Map([['1', { phone: '03-0000-0000' }]]));
    expect(csv.startsWith('﻿会社名,法人格,PR TIMES での名前,')).toBe(true);
    expect(csv).toContain(',株式会社,');
    expect(csv).toContain('"株式会社""A"",B"');
    expect(csv).toContain('"1行目\n2行目"');
    expect(csv).toContain('03-0000-0000');
    expect(csv).toContain('https://prtimes.jp/main/html/searchrlp/company_id/1');
    expect(csv).toContain('Gビズインフォ');
  });
});
