import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative Pfade, damit die App auch aus einem Unterordner (z. B. GitHub Pages) läuft.
  base: './',
  plugins: [
    react(),
    // Installierbar (Home-Bildschirm / Startmenü) und offline nutzbar.
    // Der Service Worker speichert nur den Programmcode, keine Schülerdaten.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Grader – Notenverwaltung',
        short_name: 'Grader',
        description: 'Noten, Durchschnitte und Zeugnisnoten meiner Klassen',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f5f6f8',
        theme_color: '#1f5f99',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
