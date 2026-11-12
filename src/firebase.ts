import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

/**
 * PR Times Watcher と同じ Firebase プロジェクト（prtimes-inbox）のウェブアプリの設定値。
 * ブラウザに配られる公開情報なので、リポジトリに置いてよい（読み書きの制限は prtimes-inbox の firestore.rules で行う）。
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyC47E7jrvlXY_XybBfSjRMaFJL2_f7YUDQ',
  authDomain: 'prtimes-inbox.firebaseapp.com',
  projectId: 'prtimes-inbox',
  storageBucket: 'prtimes-inbox.firebasestorage.app',
  messagingSenderId: '723210521199',
  appId: '1:723210521199:web:b1b8ec31e4ca9e17271b9a',
};

/** ログインを許可する Google アカウント（prtimes-inbox の firestore.rules と同じ値にする） */
export const OWNER_EMAIL = 'i-kato@spark-partners.jp';

/** 開発用：VITE_EMULATOR=1 で起動すると、手元の Firebase エミュレータにつなぐ（本番には関係しない） */
const useEmulator = import.meta.env.VITE_EMULATOR === '1';

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

export function getFirebase() {
  if (!app) {
    app = initializeApp(useEmulator ? { ...firebaseConfig, apiKey: 'demo-emulator-key' } : firebaseConfig);
    // 端末内にキャッシュし、2回目以降は差分だけ受け取る
    db = initializeFirestore(app, {
      localCache: useEmulator ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    auth = getAuth(app);
    if (useEmulator) {
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      (window as unknown as { __devLogin: (e: string, p: string) => Promise<unknown> }).__devLogin = (e, p) => signInWithEmailAndPassword(auth!, e, p);
    }
  }
  return { app, db: db!, auth: auth! };
}
