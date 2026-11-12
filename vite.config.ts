import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// ホーム画面に追加してアプリのように使う。新しい版を出したら、次に開いたときに自動で切り替わる
export default defineConfig({
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
