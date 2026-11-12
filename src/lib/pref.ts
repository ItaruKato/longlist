/** 都道府県（所在地の先頭から取り出す。地域での絞り込みに使う） */
export const PREFS = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
] as const;

export type Pref = (typeof PREFS)[number];

/** 所在地（例：「〒150-0002 東京都渋谷区…」）から都道府県。分からなければ null */
export function prefOf(address: string | undefined | null): Pref | null {
  if (!address) return null;
  const a = address.normalize('NFKC').replace(/^〒?\s*\d{3}-?\d{4}\s*/, '').trim();
  return PREFS.find((p) => a.startsWith(p)) ?? null;
}
