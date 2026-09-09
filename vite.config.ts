import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        VitePWA({
            registerType: 'prompt',
            injectRegister: false,
            includeAssets: ['favicon.svg', 'icons/*.png'],
            manifest: {
                name: 'Marble Scape',
                short_name: 'Marble',
                id: '/',
                start_url: '/',
                display: 'standalone',
                description: 'A cozy zero-pressure marble-run sandbox for kids 5-10.',
                background_color: '#87ceeb',
                theme_color: '#87ceeb',
                icons: [
                    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    {
                        src: 'icons/icon-512-maskable.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico,glb,ogg}'],
                navigateFallback: 'index.html',
                // The main bundle embeds Rapier WASM + three.js (~3.5 MB);
                // full offline play requires precaching it, so raise the
                // Workbox default 2 MiB cap.
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            },
        }),
    ],
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});
