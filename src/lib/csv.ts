import type { Row } from './rows';
import { regionOf } from './region';
import { stageOf, type UserState } from './state';

/** CSV に足す会社の連絡先（代表者・代表電話・HP。companies から読む） */
export interface Contact {
  representative?: string;
  phone?: string;
  url?: string;
}

const LISTED = ['', '未上場', '上場'];

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_HEADER = [
  '会社名', '法人番号', '業界', '都道府県', '地方', '資本金（円）', '厚生年金の加入者数', '従業員数', '売上高（円）', '上場',
  '最新記事', '記事数（1年）', '温度感', '進捗', '次にやること', '次の日付', '担当', 'メモ', '代表者', '代表電話', 'HP', 'PR TIMES',
];

/** Excel で文字化けしないよう、先頭に BOM を付ける */
export function toCsv(rows: Row[], states: Map<string, UserState>, contacts: Map<string, Contact>): string {
  const lines = [CSV_HEADER.join(',')];
  for (const r of rows) {
    const s = states.get(r.id);
    const c = contacts.get(r.id) ?? {};
    lines.push(
      [
        r.name, r.cn, r.industry, r.pref, regionOf(r.pref) ?? '', r.capital, r.insured, r.employees, r.sales, LISTED[r.listed],
        r.last, r.n1y, s?.temperature ?? '', stageOf(s), s?.nextText ?? '', s?.nextDate ?? '', s?.owner ?? '', s?.memo ?? '',
        c.representative ?? '', c.phone ?? '', c.url ?? '', prtimesCompanyUrl(r.id),
      ]
        .map(cell)
        .join(','),
    );
  }
  lines.push(cell('法人番号・加入者数・従業員数・売上高の出典：「Gビズインフォ」（経済産業省）をもとに作成'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export const prtimesCompanyUrl = (id: string) => `https://prtimes.jp/main/html/searchrlp/company_id/${id}`;
export const prtimesArticleUrl = (articleId: string) => `https://prtimes.jp/main/html/rd/p/${articleId}.html`;
