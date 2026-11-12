import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { getFirebase, OWNER_EMAIL } from './firebase';
import { Login } from './components/Login';
import { ListPage } from './components/ListPage';

export default function App() {
  const { auth, db } = getFirebase();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), [auth]);
  const ok = Boolean(user && user.email === OWNER_EMAIL && user.emailVerified);
  if (user === undefined) return <div className="center"><div className="card login">読み込み中…</div></div>;
  if (!ok) return <Login auth={auth} wrongUser={user} />;
  return <ListPage db={db} onSignOut={() => signOut(auth)} />;
}
