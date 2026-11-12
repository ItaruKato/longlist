import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { articleStats, headcountOf, needsTag, packRows, rowOf } from '../src/build';
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
      official: '',
      form: 'kk',
      tag: '',
      tagSubs: [],
      biz: '',
    });
  });
  it('業界タグ（台帳の companies.industryTags）を行に入れる', () => {
    expect(rowOf('10', { name: '株式会社T', industryTags: { main: 'saas', subs: ['ai'], biz: 'btob', confidence: 'high' } })).toMatchObject({ tag: 'saas', tagSubs: ['ai'], biz: 'btob' });
  });
  it('正式な名前（gBizINFO の法人名）があれば、それで法人格と除外を決める', () => {
    expect(rowOf('5', { name: 'アイリックコーポレーション', gbiz: { name: '株式会社アイリックコーポレーション' } })).toMatchObject({ official: '株式会社アイリックコーポレーション', form: 'kk', ex: '' });
    expect(rowOf('6', { name: 'テスト協会', gbiz: { name: '一般社団法人テスト協会' } })).toMatchObject({ form: 'other', ex: 'assoc' });
    // 同じ名前なら正式な名前は持たない
    expect(rowOf('7', { name: '株式会社B', gbiz: { name: '株式会社Ｂ' } })).toMatchObject({ official: '', form: 'kk' });
    expect(rowOf('8', { name: 'エキサイトホールディングス' })).toMatchObject({ official: '', form: '' });
    // PR TIMES の名前が PR事務局なら、正式な名前が会社でも外す
    expect(rowOf('9', { name: '「テスト」PR事務局', gbiz: { name: '株式会社テスト' } })).toMatchObject({ ex: 'project' });
  });
  it('企業情報がまだの会社・除外する会社', () => {
    expect(rowOf('1', { name: '株式会社まだ' })).toMatchObject({ pref: '', capital: null, insured: null, listed: 0, ex: '' });
    expect(rowOf('2', { name: '一般社団法人テスト協会', profile: { capital: '-' } })).toMatchObject({ ex: 'assoc', capital: null });
    // gBizINFO の資本金がなければ PR TIMES の企業情報の資本金を読む
    expect(rowOf('3', { name: '株式会社B', profile: { capital: '3,000万円' } }).capital).toBe(30000000);
  });
});

describe('会社 HP から拾った項目（companies.web）', () => {
  it('ほかに情報がないときだけ使う', () => {
    const web = {
      officialName: { value: '株式会社ウェブテスト', asOf: '', source: 'https://example.com/company' },
      employees: { value: '120名（2026年4月）', asOf: '2026-04', source: 'https://example.com/company' },
      capital: { value: '5,000万円', asOf: '', source: 'https://example.com/company' },
      sales: { value: '32億円', asOf: '2025年3月期', source: 'https://example.com/company' },
    };
    expect(rowOf('1', { name: 'ウェブテスト', web })).toMatchObject({ official: '株式会社ウェブテスト', form: 'kk', employees: 120, capital: 5e7, sales: 32e8 });
    // 法人番号の登録・有価証券報告書・企業情報があれば、そちらを使う
    expect(
      rowOf('2', {
        name: 'ウェブテスト',
        web,
        gbiz: { name: '株式会社ウェブテスト本社', capital: 1e8, employees: 300 },
        gbizFinance: { sales: { yen: 5e9 } },
      }),
    ).toMatchObject({ official: '株式会社ウェブテスト本社', employees: 300, capital: 1e8, sales: 5e9 });
    // HP の名前に法人格がなければ正式な名前として使わない
    expect(rowOf('3', { name: 'ウェブ', web: { officialName: { value: 'WEB TEST', asOf: '', source: '' } } })).toMatchObject({ official: '', form: '' });
  });
  it('従業員数は数字が1つのときだけ読む', () => {
    expect(headcountOf('120名')).toBe(120);
    expect(headcountOf('1,200人（2026年4月現在）')).toBe(1200);
    expect(headcountOf('連結 1,200名（単体 300名）')).toBeNull();
    expect(headcountOf('約100')).toBeNull();
    expect(headcountOf('')).toBeNull();
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
      official: '',
      form: 'kk',
      tag: i % 2 ? 'saas' : '',
      tagSubs: i % 3 ? ['ai'] : [],
      biz: 'btob',
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

describe('needsTag', () => {
  it('タグのない・除外していない・頼んでいない会社を、最新記事が新しい順に', () => {
    const base = rowOf('0', { name: 'x' });
    const rows = [
      { ...base, id: '1', last: '2026-10-01' },
      { ...base, id: '2', last: '2026-11-01' },
      { ...base, id: '3', last: '2026-11-05', tag: 'saas' },
      { ...base, id: '4', last: '2026-11-06', ex: 'assoc' },
      { ...base, id: '5', last: '2026-11-07', ex: 'assoc' },
      { ...base, id: '6', last: '2026-11-08' },
      { ...base, id: '7', last: '2026-11-09' },
    ];
    // 5 は手で一覧に戻した、6 は手で外した、7 は頼んである
    const ids = needsTag(rows, new Map<string, boolean>([['5', false], ['6', true]]), new Set(['7']), 10);
    expect(ids).toEqual(['5', '2', '1']);
    expect(needsTag(rows, new Map(), new Set(), 1)).toEqual(['7']);
  });
});

