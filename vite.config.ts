/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  plugins: [
    react(),
    // PWA: installable + offline app shell. Data itself is handled by the store (Firestore cache / local fallback).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ShuttleSync',
        short_name: 'ShuttleSync',
        description: 'If the bus is late, the student isn\'t.',
        theme_color: '#7B1E2E',
        background_color: '#15171B',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'], maximumFileSizeToCacheInBytes: 4_000_000 },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 900,
    // No manualChunks: forcing three/firebase/leaflet into named chunks created a circular chunk import that broke React in
    // production. Dynamic imports (3D scene, Firebase, lazy pages) already split them correctly.
  },
  test: { environment: 'jsdom', include: ['tests/unit/**/*.test.ts'], globals: true },
})
