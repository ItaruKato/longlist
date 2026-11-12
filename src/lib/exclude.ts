import { prefOf } from './pref';

/**
 * 一覧から外す会社（本人が決めた範囲：自治体・大学・海外企業、一般/公益の社団・財団法人、NPO 法人、学校法人）。
 * 医療法人・社会福祉法人・協同組合は残す。独立行政法人や官公庁・商工会議所は「公的機関」として外す。
 * PR TIMES の「〇〇PR事務局」「〇〇実行委員会」「〇〇プロジェクト」など、催しや宣伝のための名前も会社ではないので外す（元の会社は別に一覧に出る）。
 * 「（一社）」「（公財）」「（特非）」などの略した書き方も読む。
 * 判定は名前と所在地だけで行う（間違いは画面の「除外した会社」から戻せる）。
 */
export type ExcludeCode = 'gov' | 'univ' | 'assoc' | 'npo' | 'school' | 'public' | 'overseas' | 'project';

export const EXCLUDE_LABEL: Record<ExcludeCode, string> = {
  gov: '自治体',
  univ: '大学',
  assoc: '社団・財団法人',
  npo: 'NPO法人',
  school: '学校法人',
  public: '公的機関',
  overseas: '海外企業',
  project: 'PR事務局・プロジェクト',
};

const COMPANY = /株式会社|有限会社|合同会社|合名会社|合資会社|\((株|有|同)\)|Inc\.?|Co\.,?\s?Ltd|Corporation|K\.K\./i;
const OVERSEAS =
  /中国|中華人民共和国|台湾|韓国|大韓民国|香港|シンガポール|アメリカ|米国|U\.?S\.?A|United States|China|Taiwan|Korea|Singapore|Hong Kong|ベトナム|Vietnam|タイ王国|Thailand|マレーシア|Malaysia|インドネシア|Indonesia|フィリピン|Philippines|インド|India|オーストラリア|Australia|イギリス|英国|United Kingdom|London|フランス|France|ドイツ|Germany|カナダ|Canada|イスラエル|Israel|スイス|Switzerland|オランダ|Netherlands|スウェーデン|Sweden/i;

export function excludeReason(name: string, address?: string | null, hasCorporateNumber = false): ExcludeCode | null {
  const n = name.normalize('NFKC').replace(/\s+/g, '');
  if (/学校法人|\(学\)|\(学校\)/.test(n)) return 'school';
  if (/(一般|公益)(社団|財団)法人|\((一社|一財|公社|公財|社)\)/.test(n)) return 'assoc';
  if (/特定非営利活動法人|NPO法人|\((特非|NPO)\)/i.test(n)) return 'npo';
  if (/事務局|実行委員会|製作委員会|運営委員会|推進委員会|協議会$|委員会$/.test(n)) return 'project';
  if (!COMPANY.test(n) && (/^[「『【〈《]/.test(n) || /(プロジェクト|キャンペーン|フェスティバル|フェス)$/.test(n))) return 'project';
  if (/独立行政法人|国立研究開発法人|地方独立行政法人|\((独|国研|地独)\)|商工会議所|^(内閣府|内閣官房|[^\s]{1,6}省|[^\s]{1,6}庁)$/.test(n)) return 'public';
  if (/国立大学法人|公立大学法人/.test(n) || (/大学(校)?$|大学院大学/.test(n) && !COMPANY.test(n))) return 'univ';
  if (
    !COMPANY.test(n) &&
    (/(市役所|区役所|町役場|村役場|県庁|都庁|府庁|道庁|教育委員会)/.test(n) ||
      (n.length <= 12 && /(市|区|町|村)$/.test(n)) ||
      /^(東京都|北海道|京都府|大阪府|.{2,3}県)$/.test(n))
  )
    return 'gov';
  if (!hasCorporateNumber && address && !prefOf(address)) {
    const a = address.normalize('NFKC');
    if (OVERSEAS.test(a) || /^[\x20-\x7e]+$/.test(a)) return 'overseas';
  }
  return null;
}
