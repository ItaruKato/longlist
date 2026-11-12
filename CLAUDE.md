# Long List — Claude 向けの決まり

作業を始める前に、prtimes-inbox の `docs/plan.md` を読む（特に「共有の決まり（上書き事故を防ぐ）」「会社の台帳で取れる項目」「Long List（③）で決まっていること」）。このリポジトリの決めごとは `docs/plan.md`（このリポジトリ）にまとめる。

## 本人について
- 素人。やることは手順を分かりやすく1つずつ。決めることは質問形式で聞く
- 権限の変更（IAM・Workload Identity・承認済みドメイン）は自分で付けず、Cloud Shell に貼るだけのコマンドで案内する
- 秘密情報をチャットに貼らせない（Secret Manager だけ）
- このリポジトリの本番（prtimes-longlist）には、テストとビルドが通れば Claude の判断で main に push して出してよい（2026-11-12 本人）。prtimes-inbox を直すときは共有の決まり4のとおり

## 共有の決まり（必ず守る）
1. Firestore のルール・索引は `ItaruKato/prtimes-inbox` の `firestore.rules`・`firestore.indexes.json` だけで管理する。Long List のコレクションのルール・索引もそちらに足す。このリポジトリから Firestore をデプロイしない
2. Cloud Functions は `"codebase": "longlist"`。デプロイは `--only functions:longlist,hosting:longlist` だけ。`--force` を付けない
3. Hosting はサイト `prtimes-longlist`（target `longlist`）
4. prtimes-inbox を直すときは、別のチャットも触っているので直前に pull し、テストとビルドを通してから push する。直すのはルール・索引など必要最小限。台帳の処理を変えたいときは先に本人に相談する
5. 台帳（`companies`・`companyArticles`・`handoff` など）は読むだけ。Long List のデータは `longlist` で始まるコレクションに書く
6. 画面から関数を直接呼ばない（誰でも呼べる関数を作らない）。依頼は Firestore に書き、スケジュールの関数が処理する（prtimes-inbox の `functions/src/jobs.ts` と同じ形）。**Watcher の `jobs` コレクションは使わない**（Watcher の処理が知らない依頼を「失敗」にしてしまう）。Long List の依頼は自分のコレクション（例：`longlistJobs`）に書く
7. 秘密情報は Secret Manager だけ（`ANTHROPIC_API_KEY` など）。値をチャット・リポジトリ・ログに出さない
8. リポジトリは公開。Actions のログ・コミット・docs に、本人が読んだ記事・営業先・メモ・台帳の中身を出さない（件数だけ）
9. ログインは `i-kato@spark-partners.jp`（メール確認済み）だけ
10. コミットの作成者は `Claude <noreply@anthropic.com>`。モデル名はコミット・PR に書かない

`npm test` の `scripts/check-firebase.mjs` が 1〜3 を確かめる。
