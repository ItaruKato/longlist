import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Bytes,
  type Firestore,
} from 'firebase/firestore';
import { fromTuple, type Row } from '../lib/rows';
import type { UserState } from '../lib/state';
import type { Contact } from '../lib/csv';

export interface IndexMeta {
  builtAt: string;
  chunks: number;
  rows: number;
  excluded: number;
}

async function gunzipText(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** 一覧用のまとめ（longlistIndex）を読む。まだ作られていなければ meta は null */
export async function loadIndex(db: Firestore): Promise<{ meta: IndexMeta | null; rows: Row[] }> {
  const m = await getDoc(doc(db, 'longlistMeta', 'index'));
  if (!m.exists()) return { meta: null, rows: [] };
  const meta = m.data() as IndexMeta;
  const snaps = await Promise.all(Array.from({ length: meta.chunks }, (_, n) => getDoc(doc(db, 'longlistIndex', String(n)))));
  const parts = await Promise.all(
    snaps.map(async (s) => {
      const b = s.get('rows') as Bytes | undefined;
      if (!b) return [];
      return (JSON.parse(await gunzipText(b.toUint8Array())) as unknown[][]).map(fromTuple);
    }),
  );
  return { meta, rows: parts.flat() };
}

/** 本人が付けた温度感・進捗など（longlist）を見続ける */
export function watchStates(db: Firestore, onChange: (m: Map<string, UserState>) => void, onError: (e: unknown) => void) {
  return onSnapshot(
    collection(db, 'longlist'),
    (snap) => onChange(new Map(snap.docs.map((d) => [d.id, d.data() as UserState]))),
    onError,
  );
}

export async function saveState(db: Firestore, id: string, patch: Partial<UserState>) {
  await setDoc(doc(db, 'longlist', id), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

export interface Article {
  id: string;
  title: string;
  at: string;
}

export interface Handoff {
  id: string;
  title: string;
  readAt: string | null;
  memo: string;
  summary: string;
  stars: number;
}

export interface Detail {
  company: Record<string, unknown> | null;
  articles: Article[];
  handoff: Handoff[];
}

/** 会社の詳細：台帳の1件、記事の一覧（新しい順）、Watcher で読了にした記事のメモ */
export async function loadDetail(db: Firestore, id: string): Promise<Detail> {
  const [c, a] = await Promise.all([getDoc(doc(db, 'companies', id)), getDoc(doc(db, 'companyArticles', id))]);
  const map = (a.get('a') ?? {}) as Record<string, { t?: string; p?: string }>;
  const articles = Object.entries(map)
    .map(([k, v]) => ({ id: k, title: v.t ?? '', at: v.p ?? '' }))
    .sort((x, y) => (x.at < y.at ? 1 : -1));
  // 読了にした記事は記事IDで探す（新しい300件まで。30件ずつ）
  const ids = articles.slice(0, 300).map((x) => x.id);
  const handoff: Handoff[] = [];
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await getDocs(query(collection(db, 'handoff'), where(documentId(), 'in', ids.slice(i, i + 30))));
    for (const d of snap.docs) {
      const v = d.data();
      handoff.push({
        id: d.id,
        title: String(v.article?.title ?? ''),
        readAt: (v.readAt as string | null) ?? null,
        memo: String(v.memo ?? ''),
        summary: String(v.draft?.summary ?? ''),
        stars: Number(v.stars ?? 0),
      });
    }
  }
  handoff.sort((x, y) => ((x.readAt ?? '') < (y.readAt ?? '') ? 1 : -1));
  return { company: c.exists() ? c.data() : null, articles, handoff };
}

/**
 * 会社 HP の読み込みを台帳に頼む（webQueue/{会社ID}）。読むのは台帳側の companyWebSweep（5分ごとに少しずつ）。
 * Long List は HP を自分で読みに行かない。redo は、前に読んでいても読み直す。
 */
export async function requestWeb(db: Firestore, id: string, redo = false) {
  await setDoc(doc(db, 'webQueue', id), { at: serverTimestamp(), by: 'longlist', ...(redo ? { redo: true } : {}) }, { merge: true });
}

/** CSV 用に、代表者・代表電話・HP を読む（30社ずつ、8つ並べて） */
export async function loadContacts(db: Firestore, ids: string[], onProgress?: (done: number) => void): Promise<Map<string, Contact>> {
  const out = new Map<string, Contact>();
  const groups: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) groups.push(ids.slice(i, i + 30));
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < groups.length) {
      const g = groups[next++];
      const snap = await getDocs(query(collection(db, 'companies'), where(documentId(), 'in', g)));
      for (const d of snap.docs) {
        const p = (d.get('profile') ?? {}) as Record<string, string>;
        const gb = (d.get('gbiz') ?? {}) as Record<string, string>;
        out.set(d.id, { representative: p.representative ?? gb.representative, phone: p.phone, url: p.url ?? gb.url });
      }
      done += g.length;
      onProgress?.(done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, groups.length) }, worker));
  return out;
}

// ---- 業界タグのお試し（台帳の industryTagsSweep に頼み、AI ごとの答えを比べる） ----

export type ModelKey = 'sonnet' | 'haiku' | 'opus';
export const MODEL_LABEL: Record<ModelKey, string> = { sonnet: 'Sonnet', haiku: 'Haiku', opus: 'Opus' };
export interface TagDef {
  code: string;
  label: string;
  group: string;
}
export interface TagAnswer {
  main: string;
  subs: string[];
  biz: 'btob' | 'btoc' | 'both';
  confidence: 'high' | 'mid' | 'low';
  reason: string;
  model: string;
  at: string;
}
export type Verdict = 'ok' | 'partial' | 'ng';
export interface Trial {
  ids: string[];
  requested: ModelKey[];
  verdicts?: Record<string, Partial<Record<ModelKey, Verdict>>>;
}

/** 分類の表（台帳が meta/industryTags に書く） */
export async function loadTagDefs(db: Firestore): Promise<TagDef[]> {
  const s = await getDoc(doc(db, 'meta', 'industryTags'));
  return (s.get('tags') as TagDef[] | undefined) ?? [];
}

/** お試しの内容（選んだ会社・頼んだ AI・○△×）。画面が書くものなので、見続けずに必要なときに読む */
export async function loadTrial(db: Firestore, id: string): Promise<Trial | null> {
  const s = await getDoc(doc(db, 'longlistTrials', id));
  return s.exists() ? (s.data() as Trial) : null;
}

/** 台帳に業界タグを頼む（industryQueue/{会社ID}。すでに頼んでいる AI は残して足す） */
async function enqueue(db: Firestore, ids: string[], model: ModelKey, trial: string) {
  for (let i = 0; i < ids.length; i += 400) {
    const b = writeBatch(db);
    for (const id of ids.slice(i, i + 400)) b.set(doc(db, 'industryQueue', id), { models: arrayUnion(model), at: serverTimestamp(), by: 'longlist', trial }, { merge: true });
    await b.commit();
  }
}

export async function startTrial(db: Firestore, id: string, ids: string[], model: ModelKey) {
  await setDoc(doc(db, 'longlistTrials', id), { ids, requested: [model], createdAt: serverTimestamp() });
  await enqueue(db, ids, model, id);
}

export async function requestTrialModel(db: Firestore, id: string, ids: string[], model: ModelKey) {
  await updateDoc(doc(db, 'longlistTrials', id), { requested: arrayUnion(model) });
  await enqueue(db, ids, model, id);
}

export async function setVerdict(db: Firestore, trial: string, company: string, model: ModelKey, v: Verdict | null) {
  await updateDoc(doc(db, 'longlistTrials', trial), { [`verdicts.${company}.${model}`]: v ?? deleteField() });
}

/** AI ごとの答え（industryTrials）を30社ずつ読む */
export async function loadAnswers(db: Firestore, ids: string[]): Promise<Map<string, Partial<Record<ModelKey, TagAnswer>> & { error?: string }>> {
  const out = new Map<string, Partial<Record<ModelKey, TagAnswer>> & { error?: string }>();
  const groups: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) groups.push(ids.slice(i, i + 30));
  await Promise.all(
    groups.map(async (g) => {
      const snap = await getDocs(query(collection(db, 'industryTrials'), where(documentId(), 'in', g)));
      for (const d of snap.docs) out.set(d.id, d.data() as Partial<Record<ModelKey, TagAnswer>> & { error?: string });
    }),
  );
  return out;
}
