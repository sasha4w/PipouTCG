import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      devOptions: {
        enabled: true,
      },

      manifest: {
        name: "PipouTCG",
        short_name: "PipouTCG",
        description: "Collectionne et échange des cartes PipouTCG",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#fdfbf2",
        theme_color: "#7a1c3b",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "/favicon192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/favicon512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,

        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],

        runtimeCaching: [
          {
            // API backend — network first, fallback cache 5min
            urlPattern: /^https:\/\/tcg-backend-3lez\.onrender\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60,
              },
            },
          },
          {
            // Images externes (i.ibb.co) — Cache first pour la performance
            urlPattern: /^https:\/\/i\.ibb\.co\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 jours
              },
            },
          },
        ],
      },
    }),
  ],
});
