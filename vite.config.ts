import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icons/train-shadow-*.png"],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        globIgnores: [
          "branding/**",
          "icons/icon-*.png",
          "icons/maskable-512.png",
          "icon.svg",
        ],
      },
      manifest: {
        id: "/",
        name: "ถึงยัง — เพื่อนร่วมทาง BTS / MRT",
        short_name: "ถึงยัง",
        description: "ติดตามสถานีและเตือนก่อนถึงปลายทางขณะเปิดแอป",
        lang: "th",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f5f8fc",
        theme_color: "#2474ef",
        icons: [
          {
            src: "/icons/train-shadow-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/train-shadow-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/train-shadow-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
  preview: {
    proxy: {
      "/api": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
});
