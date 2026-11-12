import { PREFS, type Pref } from './pref';

/** 地方（地域の絞り込みで、都道府県をまとめて選ぶ） */
export const REGIONS: { name: string; prefs: Pref[] }[] = [
  { name: '北海道', prefs: ['北海道'] },
  { name: '東北', prefs: ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'] },
  { name: '関東', prefs: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'] },
  { name: '中部', prefs: ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'] },
  { name: '近畿', prefs: ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'] },
  { name: '中国', prefs: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'] },
  { name: '四国', prefs: ['徳島県', '香川県', '愛媛県', '高知県'] },
  { name: '九州・沖縄', prefs: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'] },
];

const BY_PREF = new Map<string, string>(REGIONS.flatMap((r) => r.prefs.map((p) => [p, r.name] as const)));

export const regionOf = (pref: string | null | undefined) => (pref ? (BY_PREF.get(pref) ?? null) : null);

// すべての都道府県がどこかの地方に入っていること（テストで確かめる）
export const ALL_PREFS: readonly string[] = PREFS;
