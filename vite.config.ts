import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/** 画面に出す版：GitHub の変更の番号（先頭7文字）と、作った日時（日本時間） */
function gitVersion(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}
const builtAt = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

// ホーム画面に追加してアプリのように使う。新しい版を出したら、次に開いたときに自動で切り替わる
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(gitVersion()),
    __BUILT_AT__: JSON.stringify(builtAt),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      workbox: { maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, navigateFallback: '/index.html' },
      manifest: {
        name: 'Long List',
        short_name: 'Long List',
        lang: 'ja',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1d5c4f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
});
