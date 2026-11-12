/**
 * 一覧用のまとめ（longlistIndex/{番号}.rows）の1行＝1社。
 * Cloud Functions が台帳から作り、gzip した JSON（配列の配列）を Bytes で保存する。画面はそれをほどいて使う。
 * 列を足すときは末尾に足す（古いまとめを読んでも壊れないように）。
 */
export interface Row {
  /** PR TIMES の会社ID */
  id: string;
  name: string;
  /** 業界（いまは PR TIMES の業種。業界タグができたら切り替える） */
  industry: string;
  pref: string;
  /** 資本金（円） */
  capital: number | null;
  /** 厚生年金の被保険者数 */
  insured: number | null;
  /** 上場：0 不明 / 1 未上場 / 2 上場 */
  listed: 0 | 1 | 2;
  /** 最新の記事の配信日（YYYY-MM-DD） */
  last: string;
  /** 直近1年の記事の数 */
  n1y: number;
  /** 除外の理由（なければ空） */
  ex: string;
  /** 法人番号（なければ空） */
  cn: string;
  /** 従業員数（gBizINFO。有価証券報告書・届出などから） */
  employees: number | null;
  /** 売上高（円。gBizINFO の有価証券報告書） */
  sales: number | null;
  /** 正式な名前（gBizINFO の法人名＝国税庁の法人番号の登録。PR TIMES の名前と同じか、ないときは空） */
  official: string;
  /** 法人格（src/lib/legal.ts の code。不明は空） */
  form: string;
  /** 業界タグ（台帳の companies.industryTags。meta/industryTags の code）：メイン・サブ（2つまで） */
  tag: string;
  tagSubs: string[];
  /** BtoB／BtoC：btob・btoc・both（まだなら空） */
  biz: string;
}

/** 画面に出す名前：正式な名前があればそれ */
export const displayName = (r: Row) => r.official || r.name;

export type RowTuple = [string, string, string, string, number | null, number | null, 0 | 1 | 2, string, number, string, string, number | null, number | null, string, string, string, string, string];

export const toTuple = (r: Row): RowTuple => [r.id, r.name, r.industry, r.pref, r.capital, r.insured, r.listed, r.last, r.n1y, r.ex, r.cn, r.employees, r.sales, r.official, r.form, r.tag, r.tagSubs.join(','), r.biz];

export const fromTuple = (t: unknown[]): Row => ({
  id: String(t[0] ?? ''),
  name: String(t[1] ?? ''),
  industry: String(t[2] ?? ''),
  pref: String(t[3] ?? ''),
  capital: typeof t[4] === 'number' ? t[4] : null,
  insured: typeof t[5] === 'number' ? t[5] : null,
  listed: t[6] === 1 || t[6] === 2 ? t[6] : 0,
  last: String(t[7] ?? ''),
  n1y: typeof t[8] === 'number' ? t[8] : 0,
  ex: String(t[9] ?? ''),
  cn: String(t[10] ?? ''),
  employees: typeof t[11] === 'number' ? t[11] : null,
  sales: typeof t[12] === 'number' ? t[12] : null,
  official: String(t[13] ?? ''),
  form: String(t[14] ?? ''),
  tag: String(t[15] ?? ''),
  tagSubs: t[16] ? String(t[16]).split(',').filter(Boolean) : [],
  biz: String(t[17] ?? ''),
});

/** 上場の欄（PR TIMES の企業情報の「上場」）を3つに分ける */
export function listedOf(text: string | null | undefined): 0 | 1 | 2 {
  if (!text) return 0;
  const s = text.normalize('NFKC');
  if (/未上場|非上場/.test(s)) return 1;
  if (/上場|東証|名証|札証|福証|プライム|スタンダード|グロース|マザーズ|JASDAQ|TOKYO PRO|NASDAQ|NYSE/i.test(s)) return 2;
  return 0;
}

/** 1つのまとめの文書に入れる大きさの上限（gzip したあと。Firestore の文書は 1MiB まで） */
export const CHUNK_BYTES = 900_000;
