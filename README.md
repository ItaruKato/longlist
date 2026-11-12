# Long List

営業のロングリスト。PR Times Watcher（[ItaruKato/prtimes-inbox](https://github.com/ItaruKato/prtimes-inbox)）が作る会社の台帳（`companies` / `companyArticles`）を読み、業界タグ・テーマ・規模・地域・最新記事の日付・温度感・進捗で並べ替え・絞り込みする。

- 本番：https://prtimes-longlist.web.app
- Firebase プロジェクト：`prtimes-inbox`（asia-northeast1。Watcher と共有）
- 計画・共有の決まり：prtimes-inbox の [docs/plan.md](https://github.com/ItaruKato/prtimes-inbox/blob/main/docs/plan.md)

## 開発

```bash
npm ci
npm run dev     # 画面（本番の台帳を読む。ログインが必要）
npm test        # テストと「共有の決まり」の確認
npm run build
```

main に push すると GitHub Actions がテスト・ビルドし、`hosting:longlist`（と、作ったら `functions:longlist`）だけをデプロイする。

## 共有の決まり（要点）

- Firestore のルール・索引は prtimes-inbox だけで管理する。このリポジトリの `firebase.json` には `firestore` を書かない
- Cloud Functions は codebase `longlist`。デプロイは `--only` で自分の分だけ（`--force` は使わない）
- 台帳（`companies` など）は読むだけ。Long List のデータは自分のコレクション（`longlist...`）に書く
- 画面から関数を直接呼ばない。依頼は Firestore に書き、スケジュールの関数が処理する
- 秘密情報は Secret Manager だけ。公開リポジトリなので、ログ・コミット・docs に営業先・メモ・記事の中身を出さない（件数だけ）

`scripts/check-firebase.mjs` が、このうち設定ファイルで確かめられるものを CI で毎回確かめる。
