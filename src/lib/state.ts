/** 会社ごとに本人が付けるもの（longlist/{会社ID}） */
export const STAGES = ['未着手', 'アプローチ中', '商談', '受注', '対象外'] as const;
export type Stage = (typeof STAGES)[number];
export const TEMPS = ['A', 'B', 'C'] as const;
export type Temp = (typeof TEMPS)[number];

export interface UserState {
  /** 温度感（Knowledge Base の会社ページも読む。名前を変えるときは prtimes-inbox の docs/plan.md も直す） */
  temperature?: Temp | null;
  /** 進捗（同上） */
  progress?: Stage;
  memo?: string;
  nextText?: string;
  /** 次にやる日（YYYY-MM-DD） */
  nextDate?: string;
  owner?: string;
  /** 除外の手直し：true 外す／false 戻す／なし 自動の判定のまま */
  exclude?: boolean | null;
}

export const stageOf = (s: UserState | undefined): Stage => s?.progress ?? '未着手';
