import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true, // important en dev
      },
      manifest: {
        name: "Card & Collect",
        short_name: "CardCollect",
        description: "TCG collection & boosters",
        start_url: "/",
        display: "standalone",
        background_color: "#fdfbf2",
        theme_color: "#fdfbf2",
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
    }),
  ],
});
