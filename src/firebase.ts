import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';

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

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

export function getFirebase() {
  if (!app) {
    app = initializeApp(firebaseConfig);
    // 端末内にキャッシュし、2回目以降は差分だけ受け取る
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    auth = getAuth(app);
  }
  return { app, db: db!, auth: auth! };
}
