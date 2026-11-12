import { gzipSync } from 'node:zlib';
import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import { CHUNK_BYTES, listedOf, toTuple, type Row, type RowTuple } from '../../src/lib/rows';
import { excludeReason } from '../../src/lib/exclude';
import { prefOf } from '../../src/lib/pref';
import { parseYen } from '../../src/lib/yen';
import { legalFormOf } from '../../src/lib/legal';

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
  // 会社 HP から台帳の companyWebSweep が拾った項目（{ value, asOf, source }）。Long List は HP を自分で読まない
  const web = (c.web ?? {}) as Record<string, { value?: string } | null | undefined>;
  const webValue = (k: string) => (typeof web[k]?.value === 'string' ? web[k]!.value!.trim() : '');
  // 正式な名前：法人番号の登録（gBizINFO）が一番確か。なければ HP の会社概要の名前。PR TIMES の名前と同じなら持たない
  const legalName = (typeof gbiz.name === 'string' ? gbiz.name.trim() : '') || (legalFormOf(webValue('officialName')) ? webValue('officialName') : '');
  const official = legalName && legalName.normalize('NFKC') !== name.normalize('NFKC') ? legalName : '';
  const address = (profile.address as string | undefined) ?? (gbiz.location as string | undefined);
  const cn = String(c.corporateNumber ?? '');
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const capital = num(gbiz.capital) ?? parseYen(profile.capital as string | undefined) ?? parseYen(webValue('capital'));
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
    // 正式な名前（社団法人など）と PR TIMES の名前（PR事務局など）の、どちらかで外すと決まれば外す
    ex: excludeReason(legalName || name, address, Boolean(cn)) ?? (legalName ? excludeReason(name, address, Boolean(cn)) : null) ?? '',
    cn,
    employees: num(gbiz.employees) ?? num(finance.employees) ?? headcountOf(webValue('employees')),
    sales: num((finance.sales as Data | undefined)?.yen) ?? parseYen(webValue('sales')),
    official,
    form: legalFormOf(legalName || name),
  };
}

/** HP の「従業員数」（例：120名、連結 1,200名（単体 300名））から人数。数字が1つだけのときだけ読む */
export function headcountOf(text: string): number | null {
  if (!text) return null;
  const nums = [...text.normalize('NFKC').matchAll(/(\d[\d,]*)\s*(名|人)/g)].map((m) => Number(m[1].replace(/,/g, '')));
  return nums.length === 1 && Number.isFinite(nums[0]) && nums[0] > 0 ? nums[0] : null;
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
  await scan(db, 'companies', ['name', 'profile', 'corporateNumber', 'gbiz.name', 'gbiz.capital', 'gbiz.employees', 'gbiz.location', 'gbizInsured.total', 'gbizFinance.sales', 'gbizFinance.employees', 'web.officialName', 'web.employees', 'web.capital', 'web.sales'], (id, c) => {
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
