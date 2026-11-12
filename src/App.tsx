import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { getFirebase, OWNER_EMAIL } from './firebase';
import { Login } from './components/Login';
import { ledgerCounts, type LedgerCounts } from './lib/ledger';

export default function App() {
  const { auth, db } = getFirebase();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), [auth]);
  const ok = Boolean(user && user.email === OWNER_EMAIL && user.emailVerified);

  const [counts, setCounts] = useState<LedgerCounts | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!ok) return;
    ledgerCounts(db).then(setCounts, (e) => setErr(String((e as { code?: string }).code ?? e)));
  }, [ok, db]);

  if (user === undefined) return <div className="center"><div className="card">読み込み中…</div></div>;
  if (!ok) return <Login auth={auth} wrongUser={user} />;
  const n = (v: number) => v.toLocaleString('ja-JP');
  return (
    <div className="center">
      <div className="card">
        <b>Long List</b>
        <p>準備中です。ログインと台帳の読み込みができることを確かめるための画面です。</p>
        {counts ? (
          <dl className="counts">
            <dt>台帳の会社</dt>
            <dd>{n(counts.companies)}社</dd>
            <dt>法人番号が決まった会社</dt>
            <dd>{n(counts.withCorporateNumber)}社</dd>
            <dt>厚生年金の加入者数が分かった会社</dt>
            <dd>{n(counts.withInsured)}社</dd>
            <dt>財務（有価証券報告書）がある会社</dt>
            <dd>{n(counts.withFinance)}社</dd>
          </dl>
        ) : err ? (
          <p className="err">台帳を読めませんでした（{err}）</p>
        ) : (
          <p>台帳を読み込み中…</p>
        )}
        <p className="source">
          法人番号・加入者数・財務の出典：「
          <a href="https://info.gbiz.go.jp/" target="_blank" rel="noopener noreferrer">Gビズインフォ</a>
          」（経済産業省）をもとに作成
        </p>
        <button className="btn" type="button" onClick={() => signOut(auth)}>ログアウト</button>
      </div>
    </div>
  );
}
