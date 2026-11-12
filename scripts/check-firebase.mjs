// 共有の決まり（prtimes-inbox の docs/plan.md）を守っているかを確かめる。CI（npm test）で毎回動かす。
// - Firestore のルール・索引はこのリポジトリからデプロイしない（firebase.json に firestore を書かない）
// - Hosting は target "longlist"（prtimes-longlist サイト）だけ
// - Cloud Functions は codebase "longlist" だけ（"default" は Watcher のもの）
// - デプロイは --only で自分の分だけ。--force は使わない
import { readFileSync } from 'node:fs';

const fail = [];
const fb = JSON.parse(readFileSync('firebase.json', 'utf8'));
for (const k of ['firestore', 'storage', 'database', 'remoteconfig', 'extensions']) {
  if (k in fb) fail.push(`firebase.json に "${k}" を書かない（prtimes-inbox で管理する）`);
}
const hosting = [fb.hosting ?? []].flat();
if (hosting.some((h) => h.target !== 'longlist' || h.site)) fail.push('hosting は target "longlist" だけにする');
const functions = [fb.functions ?? []].flat();
if (functions.some((f) => f.codebase !== 'longlist')) fail.push('functions は codebase "longlist" だけにする');

const rc = JSON.parse(readFileSync('.firebaserc', 'utf8'));
const sites = rc.targets?.['prtimes-inbox']?.hosting?.longlist ?? [];
if (sites.length !== 1 || sites[0] !== 'prtimes-longlist') fail.push('.firebaserc の hosting:longlist は prtimes-longlist だけにする');

const wf = readFileSync('.github/workflows/deploy.yml', 'utf8');
for (const line of wf.split('\n').filter((l) => /firebase-tools.*\bdeploy\b/.test(l))) {
  const only = line.match(/--only\s+(\S+)/)?.[1];
  if (!only) fail.push('デプロイには --only を付ける');
  else if (only.split(',').some((x) => !/^(hosting|functions):longlist$/.test(x))) fail.push(`--only は hosting:longlist / functions:longlist だけ（いま: ${only}）`);
  if (/--force/.test(line)) fail.push('デプロイに --force を付けない');
}

if (fail.length) {
  console.error('共有の決まりに合っていません:\n- ' + fail.join('\n- '));
  process.exit(1);
}
console.log('共有の決まり: OK');
