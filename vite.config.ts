/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// Percorso di pubblicazione in produzione. Sovrascrivibile con BASE_PATH=/altro/ npm run build
const BASE_PATH = process.env.BASE_PATH ?? '/pianotutor/';

export default defineConfig(({ command, isPreview }) => ({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  base: command === 'build' || isPreview ? BASE_PATH : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Piano Tutor',
        short_name: 'Piano Tutor',
        description: 'Impara a suonare il pianoforte partendo da zero.',
        lang: 'it',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f1220',
        theme_color: '#0f1220',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + campioni audio + contenuti: tutto disponibile offline dopo il primo caricamento.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,mp3,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
}));
