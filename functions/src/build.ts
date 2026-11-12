import { gzipSync } from 'node:zlib';
import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import { CHUNK_BYTES, listedOf, toTuple, type Row, type RowTuple } from '../../src/lib/rows';
import { excludeReason } from '../../src/lib/exclude';
import { prefOf } from '../../src/lib/pref';
import { parseYen } from '../../src/lib/yen';

/**
 * 台帳（companies・companyArticles。prtimes-inbox が作る）を読むだけで、一覧用のまとめ（longlistIndex）を作り直す。
 * まとめは1行1社の配列を JSON にして gzip し、1MiB に収まるように分けて保存する。
 * 書き込み先は longlistIndex/{番号} と longlistMeta/index だけ。
 */

const PAGE = 1000;
const YEAR_MS = 365 * 86400e3;

type Data = Record<string, unknown>;

/** companies の1件から一覧の1行を作る（記事の情報はあとで足す） */
export function rowOf(id: string, c: Data): Row {
  const profile = (c.profile ?? {}) as Data;
  const gbiz = (c.gbiz ?? {}) as Data;
  const insured = (c.gbizInsured ?? {}) as Data;
  const finance = (c.gbizFinance ?? {}) as Data;
  const name = String(c.name ?? '');
  const address = (profile.address as string | undefined) ?? (gbiz.location as string | undefined);
  const cn = String(c.corporateNumber ?? '');
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const capital = num(gbiz.capital) ?? parseYen(profile.capital as string | undefined);
  return {
    id,
    name,
    industry: String(profile.industry ?? ''),
    pref: prefOf(address) ?? '',
    capital: capital && capital > 0 ? capital : null,
    insured: num(insured.total),
    listed: listedOf(profile.listed as string | undefined),
    last: '',
    n1y: 0,
    ex: excludeReason(name, address, Boolean(cn)) ?? '',
    cn,
    employees: num(gbiz.employees) ?? num(finance.employees),
    sales: num((finance.sales as Data | undefined)?.yen),
  };
}

/** companyArticles の1件から、最新の配信日（JST の日付）と直近1年の記事の数 */
export function articleStats(a: unknown, now: number): { last: string; n1y: number } {
  let lastMs = 0;
  let n1y = 0;
  for (const v of Object.values((a ?? {}) as Record<string, { p?: string }>)) {
    const t = v?.p ? new Date(v.p).getTime() : NaN;
    if (!Number.isFinite(t)) continue;
    if (t > lastMs) lastMs = t;
    if (now - t <= YEAR_MS) n1y++;
  }
  return { last: lastMs ? new Date(lastMs + 9 * 3600e3).toISOString().slice(0, 10) : '', n1y };
}

/** 行を gzip したまとめに分ける（1つあたり CHUNK_BYTES まで） */
export function packRows(rows: Row[], limit = CHUNK_BYTES): Buffer[] {
  const out: Buffer[] = [];
  let i = 0;
  while (i < rows.length) {
    // おおよその件数で区切ってから、大きすぎれば半分にする
    let n = Math.min(rows.length - i, 20000);
    for (;;) {
      const tuples: RowTuple[] = rows.slice(i, i + n).map(toTuple);
      const gz = gzipSync(Buffer.from(JSON.stringify(tuples)));
      if (gz.length <= limit || n === 1) {
        out.push(gz);
        i += n;
        break;
      }
      n = Math.ceil(n / 2);
    }
  }
  return out;
}

async function scan(db: Firestore, collection: string, fields: string[], each: (id: string, d: Data) => void) {
  let last: string | null = null;
  let count = 0;
  for (;;) {
    let q = db.collection(collection).orderBy(FieldPath.documentId()).select(...fields).limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    for (const d of snap.docs) each(d.id, d.data());
    count += snap.size;
    if (snap.size < PAGE) return count;
    last = snap.docs[snap.docs.length - 1].id;
  }
}

export async function buildIndex(deps: { db: Firestore; now?: number; log?: (msg: string, data?: Record<string, unknown>) => void }) {
  const { db } = deps;
  const now = deps.now ?? Date.now();
  const started = Date.now();
  const rows = new Map<string, Row>();
  await scan(db, 'companies', ['name', 'profile', 'corporateNumber', 'gbiz.capital', 'gbiz.employees', 'gbiz.location', 'gbizInsured.total', 'gbizFinance.sales', 'gbizFinance.employees'], (id, c) => {
    if (c.name) rows.set(id, rowOf(id, c));
  });
  await scan(db, 'companyArticles', ['a'], (id, d) => {
    const r = rows.get(id);
    if (r) Object.assign(r, articleStats(d.a, now));
  });
  const list = [...rows.values()].sort((a, b) => Number(a.id) - Number(b.id));
  const chunks = packRows(list);

  // 先に新しいまとめを書き、最後に目次（longlistMeta/index）を切り替える。余った古いまとめは消す
  const builtAt = new Date(now).toISOString();
  for (const [n, gz] of chunks.entries()) {
    await db.collection('longlistIndex').doc(String(n)).set({ rows: gz, builtAt });
  }
  const old = await db.collection('longlistIndex').select().get();
  const excluded = list.filter((r) => r.ex).length;
  await db.collection('longlistMeta').doc('index').set({
    v: 1,
    builtAt,
    chunks: chunks.length,
    rows: list.length,
    excluded,
    bytes: chunks.reduce((a, b) => a + b.length, 0),
    tookMs: Date.now() - started,
  });
  for (const d of old.docs) if (Number(d.id) >= chunks.length) await d.ref.delete();
  const result = { rows: list.length, excluded, chunks: chunks.length };
  deps.log?.('longlist index built', result);
  return result;
}
