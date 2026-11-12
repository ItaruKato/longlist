/**
 * 「1億2,000万円」「10,000,000円」「100百万円」「1,000千円」などを円の数にする。
 * 外貨・読めないものは null。
 */
const UNITS: Record<string, number> = { 兆: 1e12, 億: 1e8, 千万: 1e7, 百万: 1e6, 万: 1e4, 千: 1e3 };

export function parseYen(text: string | null | undefined): number | null {
  if (!text) return null;
  const s = text.normalize('NFKC').replace(/[,\s]/g, '');
  if (/ドル|\$|USD|US\$|ユーロ|€|EUR|元|ウォン|ポンド/i.test(s)) return null;
  const m = s.match(/[\d.]+(?:兆|億|千万|百万|万|千)?(?:[\d.]+(?:兆|億|千万|百万|万|千)?)*円?/);
  if (!m || !/\d/.test(m[0])) return null;
  const part = m[0];
  if (!/円|兆|億|万|千/.test(part)) return null; // 単位がないものは読まない
  let total = 0;
  for (const t of part.replace(/円$/, '').matchAll(/([\d.]+)(兆|億|千万|百万|万|千)?/g)) {
    const n = Number(t[1]);
    if (!Number.isFinite(n)) return null;
    total += n * (t[2] ? UNITS[t[2]] : 1);
  }
  return total > 0 ? Math.round(total) : null;
}

/** 画面用の短い表記（例：1.2億円、3,000万円） */
export function yenLabel(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (v >= 1e12) return `${trim(v / 1e12)}兆円`;
  if (v >= 1e8) return `${trim(v / 1e8)}億円`;
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString('ja-JP')}万円`;
  return `${v.toLocaleString('ja-JP')}円`;
}

const trim = (n: number) => (n >= 100 ? Math.round(n).toLocaleString('ja-JP') : String(Math.round(n * 10) / 10));
