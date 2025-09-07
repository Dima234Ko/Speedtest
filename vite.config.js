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
        name: 'Связь-энерго (dev)',
        short_name: 'Связь-энерго (dev)',
        description: 'Связь-энерго (dev)',
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
    port: 5173,
    host: '0.0.0.0',
    open: true,
    https: {
      key: fs.readFileSync('./sert/key.txt'),
      cert: fs.readFileSync('./sert/sv_en_ru_2026_08_08.crt'),
    },
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
    open: true,
    https: {
      key: fs.readFileSync('./sert/key.txt'),
      cert: fs.readFileSync('./sert/sv_en_ru_2026_08_08.crt'),
    },
  },
});