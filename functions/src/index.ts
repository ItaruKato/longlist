import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { buildIndex } from './build';

/**
 * Long List の Cloud Functions（codebase "longlist"）。関数名は Watcher・Knowledge Base と重ならないよう longlist で始める。
 * 画面から直接呼べる関数は作らない（スケジュールだけ）。ログには件数だけを出す。
 */
initializeApp();
const db = getFirestore();

/** 台帳から一覧用のまとめを作り直す（6時間ごと。デプロイの直後にも GitHub Actions から1回動かす） */
export const longlistBuildIndex = onSchedule(
  { region: 'asia-northeast1', timeZone: 'Asia/Tokyo', schedule: '15 */6 * * *', timeoutSeconds: 540, memory: '1GiB', retryCount: 0 },
  async () => {
    await buildIndex({ db, log: (msg, data) => logger.info(msg, data) });
  },
);
