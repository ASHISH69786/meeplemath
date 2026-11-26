// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import { AstroPWAIntegration } from '@vite-pwa/astro';

// https://astro.build/config
export default defineConfig({
  site: 'https://meeplemath.org',
  trailingSlash: 'always',
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    preact(),
    sitemap({ filter: (page) => !page.includes('/404') }),
    AstroPWAIntegration({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MeepleMath – Board Game Score Calculators',
        short_name: 'MeepleMath',
        description: 'Free board game score calculators that work offline.',
        start_url: '/',
        display: 'standalone',
        theme_color: '#fff6e0',
        background_color: '#fff6e0',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      generateSW: {
        // Precache every page so all calculators work offline after one visit.
        globPatterns: ['**/*.{html,js,css,svg,ico}', 'apple-touch-icon-*.png'],
        // 404.html would be precached as "404/", which Cloudflare Pages answers with a 404 and breaks install.
        globIgnores: ['404.html'],
        navigateFallback: null,
      },
    }),
  ],
});
