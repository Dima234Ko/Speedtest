import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'icon-32.png',
        'icon-120.png',
        'icon-180.png',
        'icon-512.png',
      ],
      manifest: {
        name: 'Скорость',
        short_name: 'Скорость',
        description: 'Скорость',
        display: 'fullscreen',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        version: '1.2.0',
        icons: [
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-120.png',
            sizes: '120x120',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => ['document', 'script', 'style'].includes(request.destination),
            handler: 'NetworkFirst',
          },
        ],
      },
    }),
  ],
  server: {
    port: 9444,
    host: '0.0.0.0',
    open: true,
    https: {
      key: fs.readFileSync('./sert/key.txt'),
      cert: fs.readFileSync('./sert/sv_en_ru_2026_08_08.crt'),
    },
    proxy: {
      '/backend': {
        target: 'http://172.24.6.13/backend',
        changeOrigin: false,
        secure: false,
        rewrite: (path) => path.replace(/^\/backend/, ''),
      },
      '/results': { // Добавлено новое правило для /results
        target: 'http://172.24.6.13/results',
        changeOrigin: false,
        secure: false,
        rewrite: (path) => path.replace(/^\/results/, ''),
      },
    },
  },
  preview: {
    port: 9444,
    host: '0.0.0.0',
    open: true,
    https: {
      key: fs.readFileSync('./sert/key.txt'),
      cert: fs.readFileSync('./sert/sv_en_ru_2026_08_08.crt'),
    },
    proxy: {
      '/backend': {
        target: 'http://172.24.6.13/backend',
        changeOrigin: false,
        secure: false,
        rewrite: (path) => path.replace(/^\/backend/, ''),
      },
      '/results': { // Добавлено новое правило для /results
        target: 'http://172.24.6.13/results',
        changeOrigin: false,
        secure: false,
        rewrite: (path) => path.replace(/^\/results/, ''),
      },
    },
  },
});