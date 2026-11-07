/// <reference types="vitest/config" />
/// <reference types="node" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

/** Build version from the commit being built, e.g. "2026.11.07 · 7209116". Every deploy is a new commit, so it updates itself. */
function appVersion(): string {
  try {
    const [date, sha] = execSync('git log -1 --format=%cs%n%h', { encoding: 'utf8' }).trim().split('\n');
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim() ? '+' : '';
    return `${date.replaceAll('-', '.')} · ${sha}${dirty}`;
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  base: '/line-change-app/',
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Line Changes',
        short_name: 'Lines',
        description: 'Fair, fast line changes for youth hockey.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#111111',
        theme_color: '#111111',
        start_url: '/line-change-app/',
        scope: '/line-change-app/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,ico}'] },
    }),
  ],
  test: { environment: 'jsdom' },
});
