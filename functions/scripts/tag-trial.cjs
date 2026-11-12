/**
 * 業界タグのお試しを GitHub Actions から動かす（画面の「Sonnet で200社を試す」「○○ でも試す」と同じこと）。
 *   node scripts/tag-trial.cjs start sonnet   … お試しがなければ200社をくじ引きで選び、その AI で頼む。あれば、その AI を足して同じ会社で頼む
 *   node scripts/tag-trial.cjs status         … 進み具合（件数だけ）
 * 公開リポジトリの Actions のログに出るので、会社名・答えの中身は出さない（件数だけ）。
 */
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { gunzipSync } = require('node:zlib');
const { fromTuple } = require('../lib/src/lib/rows');
const { pickSample, agreementOf } = require('../lib/src/lib/trial');

const TRIAL = 't1';
const SIZE = 200;
const MODELS = ['sonnet', 'haiku', 'opus'];

initializeApp({ projectId: 'prtimes-inbox' });
const db = getFirestore();

async function loadRows() {
  const meta = (await db.doc('longlistMeta/index').get()).data();
  if (!meta) throw new Error('一覧のまとめがまだありません');
  const rows = [];
  for (let n = 0; n < meta.chunks; n++) {
    const b = (await db.doc(`longlistIndex/${n}`).get()).get('rows');
    rows.push(...JSON.parse(gunzipSync(Buffer.from(b)).toString()).map(fromTuple));
  }
  const states = new Map((await db.collection('longlist').get()).docs.map((d) => [d.id, d.data()]));
  return { rows, states };
}

async function enqueue(ids, model) {
  for (let i = 0; i < ids.length; i += 400) {
    const b = db.batch();
    for (const id of ids.slice(i, i + 400)) b.set(db.doc(`industryQueue/${id}`), { models: FieldValue.arrayUnion(model), at: FieldValue.serverTimestamp(), by: 'longlist', trial: TRIAL }, { merge: true });
    await b.commit();
  }
}

async function start(model) {
  if (!MODELS.includes(model)) throw new Error(`AI は ${MODELS.join(' / ')} のどれか`);
  const ref = db.doc(`longlistTrials/${TRIAL}`);
  const t = (await ref.get()).data();
  if (!t) {
    const { rows, states } = await loadRows();
    const ids = pickSample(rows, states, SIZE);
    await ref.set({ ids, requested: [model], createdAt: FieldValue.serverTimestamp(), by: 'actions' });
    await enqueue(ids, model);
    console.log(`お試しを始めました：一覧の ${rows.length}社から ${ids.length}社をくじ引きで選び、${model} で頼みました`);
    return;
  }
  if ((t.requested ?? []).includes(model)) {
    console.log(`${model} はもう頼んであります（${t.ids.length}社）。何もしません`);
    return;
  }
  await ref.update({ requested: FieldValue.arrayUnion(model) });
  await enqueue(t.ids, model);
  console.log(`同じ ${t.ids.length}社を ${model} でも頼みました`);
}

async function status() {
  const t = (await db.doc(`longlistTrials/${TRIAL}`).get()).data();
  if (!t) return console.log('お試しはまだありません');
  const counts = Object.fromEntries((t.requested ?? []).map((m) => [m, { answered: 0, low: 0, ok: 0, partial: 0, ng: 0 }]));
  let errors = 0;
  const agree = { same: 0, split: 0, low: 0, waiting: 0 };
  for (let i = 0; i < t.ids.length; i += 100) {
    const snaps = await db.getAll(...t.ids.slice(i, i + 100).map((id) => db.doc(`industryTrials/${id}`)));
    for (const s of snaps) {
      if (s.get('error')) errors++;
      agree[agreementOf(s.data(), t.requested ?? [])]++;
      for (const m of Object.keys(counts)) {
        const a = s.get(m);
        if (a?.main) {
          counts[m].answered++;
          if (a.confidence === 'low') counts[m].low++;
        }
        const v = t.verdicts?.[s.id]?.[m];
        if (v) counts[m][v]++;
      }
    }
  }
  const queue = (await db.collection('industryQueue').count().get()).data().count;
  console.log(`お試し ${t.ids.length}社・依頼の残り ${queue}件・エラー ${errors}社`);
  for (const [m, c] of Object.entries(counts)) console.log(`  ${m}: 答え ${c.answered}・迷い ${c.low}・見直し ○${c.ok} △${c.partial} ×${c.ng}`);
  console.log(`  メインのタグ：全部同じ ${agree.same}・同じだが迷いあり ${agree.low}・分かれた ${agree.split}・答え待ち ${agree.waiting}`);
  const meta = (await db.doc('meta/industry').get()).data();
  if (meta) console.log('台帳の処理（直近）:', JSON.stringify(meta));
}

const [cmd, arg] = process.argv.slice(2);
(cmd === 'start' ? start(arg) : status()).catch((e) => {
  console.error('失敗:', String(e).slice(0, 300));
  process.exit(1);
});
