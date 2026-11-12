/**
 * 法人格（株式会社・合同会社など）。正式な名前（gBizINFO の法人名＝国税庁の法人番号の登録）から読むのが確か。
 * 正式な名前がない会社は PR TIMES の名前から読み、書いていなければ不明（空）。
 */
export const LEGAL_FORMS: { code: string; label: string; re: RegExp }[] = [
  { code: 'kk', label: '株式会社', re: /株式会社|\(株\)/ },
  { code: 'gk', label: '合同会社', re: /合同会社|\(同\)/ },
  { code: 'yk', label: '有限会社', re: /有限会社|\(有\)/ },
  { code: 'gm', label: '合名会社', re: /合名会社|\(名\)/ },
  { code: 'gs', label: '合資会社', re: /合資会社|\(資\)/ },
  {
    code: 'other',
    label: 'その他の法人',
    re: /医療法人|社会福祉法人|(一般|公益)(社団|財団)法人|\((一社|一財|公社|公財|特非|医|社福|学|独|国研|地独)\)|特定非営利活動法人|NPO法人|学校法人|協同組合|独立行政法人|国立研究開発法人|国立大学法人|公立大学法人|宗教法人|弁護士法人|税理士法人|監査法人|司法書士法人|行政書士法人|社会保険労務士法人|特許業務法人|農事組合法人|相互会社|有限責任事業組合/i,
  },
];

export const legalLabel = (code: string) => LEGAL_FORMS.find((f) => f.code === code)?.label ?? '不明';

export function legalFormOf(name: string | null | undefined): string {
  if (!name) return '';
  const n = name.normalize('NFKC');
  return LEGAL_FORMS.find((f) => f.re.test(n))?.code ?? '';
}
