import { describe, expect, it } from 'vitest';
import { parseYen, yenLabel } from './yen';
import { excludeReason } from './exclude';
import { ALL_PREFS, REGIONS, regionOf } from './region';
import { fromTuple, listedOf, toTuple, type Row } from './rows';
import { legalFormOf } from './legal';

describe('parseYen', () => {
  it('日本の書き方を円にする', () => {
    expect(parseYen('1億2,000万円')).toBe(120_000_000);
    expect(parseYen('10,000,000円')).toBe(10_000_000);
    expect(parseYen('１０００万円')).toBe(10_000_000);
    expect(parseYen('100百万円')).toBe(100_000_000);
    expect(parseYen('1,000千円')).toBe(1_000_000);
    expect(parseYen('3億円（資本準備金含む）')).toBe(300_000_000);
    expect(parseYen('5,000万')).toBe(50_000_000);
    expect(parseYen('1.5億円')).toBe(150_000_000);
  });
  it('読めないもの・外貨は null', () => {
    expect(parseYen('')).toBeNull();
    expect(parseYen(undefined)).toBeNull();
    expect(parseYen('非公開')).toBeNull();
    expect(parseYen('USD 1,000,000')).toBeNull();
    expect(parseYen('100万ドル')).toBeNull();
    expect(parseYen('2015年')).toBeNull();
  });
  it('短い表記', () => {
    expect(yenLabel(120_000_000)).toBe('1.2億円');
    expect(yenLabel(30_000_000)).toBe('3,000万円');
    expect(yenLabel(12_607_858e6)).toBe('12.6兆円');
    expect(yenLabel(null)).toBe('');
  });
});

describe('excludeReason', () => {
  it('外す', () => {
    expect(excludeReason('学校法人テスト学園')).toBe('school');
    expect(excludeReason('一般社団法人日本テスト協会')).toBe('assoc');
    expect(excludeReason('公益財団法人テスト財団')).toBe('assoc');
    expect(excludeReason('特定非営利活動法人テスト')).toBe('npo');
    expect(excludeReason('ＮＰＯ法人テスト')).toBe('npo');
    expect(excludeReason('国立大学法人東京大学')).toBe('univ');
    expect(excludeReason('東京大学')).toBe('univ');
    expect(excludeReason('横浜市')).toBe('gov');
    expect(excludeReason('北海道上士幌町')).toBe('gov');
    expect(excludeReason('大阪府')).toBe('gov');
    expect(excludeReason('渋谷区役所')).toBe('gov');
    expect(excludeReason('国立研究開発法人テスト機構')).toBe('public');
    expect(excludeReason('経済産業省')).toBe('public');
    expect(excludeReason('Test Inc.', '1 Market St, San Francisco, CA, USA')).toBe('overseas');
    expect(excludeReason('テスト有限公司', '中国上海市浦東新区')).toBe('overseas');
    // 略した書き方
    expect(excludeReason('(一財)ブランド・マネージャー認定協会')).toBe('assoc');
    expect(excludeReason('（一社）SAKE女の会')).toBe('assoc');
    expect(excludeReason('(公財)日本テスト機構')).toBe('assoc');
    expect(excludeReason('（公社）近畿圏不動産流通機構')).toBe('assoc');
    expect(excludeReason('（特非）テスト')).toBe('npo');
    // PR事務局・実行委員会・プロジェクト
    expect(excludeReason('「#ポカリスナップ」PR事務局')).toBe('project');
    expect(excludeReason('「Vivoo」 事務局（大塚製薬株式会社）')).toBe('project');
    expect(excludeReason('「VIVANT IMMERSIVE MISSION」 実行委員会')).toBe('project');
    expect(excludeReason('「ＳＴＯＰ！ヒートショック」プロジェクト')).toBe('project');
    expect(excludeReason('「アーバンスポーツフェス IN 笠間 2026」広報事務局')).toBe('project');
    expect(excludeReason('テストミュージックフェス')).toBe('project');
    expect(excludeReason('テスト推進協議会')).toBe('project');
  });
  it('残す', () => {
    expect(excludeReason('株式会社テスト')).toBeNull();
    expect(excludeReason('医療法人社団テスト会')).toBeNull();
    expect(excludeReason('社会福祉法人テスト')).toBeNull();
    expect(excludeReason('株式会社大学ジャーナル')).toBeNull();
    expect(excludeReason('株式会社プロジェクトテスト')).toBeNull();
    expect(excludeReason('テストプロジェクト株式会社')).toBeNull();
    // 法人格の書いていない個人の事業などは残す（国税庁の法人番号で確かめられるようになったら見直す）
    expect(excludeReason('"allo?" 渡邊真弓写真事務所')).toBeNull();
    expect(excludeReason('(N)ONE ATELIER')).toBeNull();
    expect(excludeReason('株式会社まちづくり三鷹市')).toBeNull();
    expect(excludeReason('テスト株式会社', '東京都渋谷区')).toBeNull();
    // 法人番号がある会社は海外としない（日本の法人）
    expect(excludeReason('Sample Japan K.K.', 'Tokyo', true)).toBeNull();
    // 都道府県が書かれていない日本の住所は海外にしない
    expect(excludeReason('株式会社テスト', '渋谷区道玄坂1-1')).toBeNull();
  });
});

describe('legalFormOf', () => {
  it('法人格を読む', () => {
    expect(legalFormOf('株式会社テスト')).toBe('kk');
    expect(legalFormOf('テスト株式会社')).toBe('kk');
    expect(legalFormOf('㈱テスト')).toBe('kk');
    expect(legalFormOf('（株）テスト')).toBe('kk');
    expect(legalFormOf('テスト合同会社')).toBe('gk');
    expect(legalFormOf('有限会社テスト')).toBe('yk');
    expect(legalFormOf('医療法人社団テスト会')).toBe('other');
    expect(legalFormOf('一般社団法人テスト')).toBe('other');
    expect(legalFormOf('（一社）テスト')).toBe('other');
    expect(legalFormOf('エキサイトホールディングス')).toBe('');
    expect(legalFormOf('')).toBe('');
  });
});

describe('region', () => {
  it('47都道府県がどこかの地方に入る', () => {
    expect(REGIONS.flatMap((r) => r.prefs).sort()).toEqual([...ALL_PREFS].sort());
    expect(regionOf('東京都')).toBe('関東');
    expect(regionOf('沖縄県')).toBe('九州・沖縄');
    expect(regionOf('')).toBeNull();
  });
});

describe('rows', () => {
  it('行の形を行き来できる', () => {
    const r: Row = { id: '12', name: 'A', industry: '情報通信', pref: '東京都', capital: 1e7, insured: 25, listed: 1, last: '2026-11-01', n1y: 3, ex: '', cn: '1234567890123', employees: null, sales: null, official: '株式会社A', form: 'kk' };
    expect(fromTuple(JSON.parse(JSON.stringify(toTuple(r))))).toEqual(r);
    expect(fromTuple(['9', 'B'])).toMatchObject({ id: '9', name: 'B', capital: null, listed: 0, n1y: 0, official: '', form: '' });
  });
  it('上場の欄', () => {
    expect(listedOf('未上場')).toBe(1);
    expect(listedOf('東証グロース')).toBe(2);
    expect(listedOf('東京証券取引所プライム市場')).toBe(2);
    expect(listedOf('')).toBe(0);
    expect(listedOf('-')).toBe(0);
  });
});
