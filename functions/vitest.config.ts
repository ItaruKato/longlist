import { defineConfig } from 'vitest/config';

// 画面側の vite.config.ts を読まないように、ここで設定を閉じる
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
