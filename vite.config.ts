import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  define: {
    global: "globalThis",
  },
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",

      manifest: {
        id: "/",
        name: "Bien Criollas",
        short_name: "Bien Criollas",
        description: "Sistema de gestión para Bien Criollas",
        lang: "es-AR",
        dir: "ltr",
        theme_color: "#f34343",
        background_color: "#ffffff",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        orientation: "any",
        start_url: "/",
        scope: "/",
        categories: ["business", "productivity"],
        prefer_related_applications: false,

        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,mp3}"],
        globIgnores: [
          "icons/logo.png",
          "icons.svg",
          "sound/intro.mp3",
          "sound/intro2.mp3",
        ],

        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "bien-criollas-pages",
            },
          },

          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api") &&
              url.hostname ===
                "biencriollas-backend-production.up.railway.app",
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "bien-criollas-google-fonts-stylesheets",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "bien-criollas-google-fonts-webfonts",
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/")) {
            return "react-vendor";
          }
          if (id.includes("/node_modules/framer-motion/")) {
            return "motion-vendor";
          }
          if (id.includes("/node_modules/@stomp/") || id.includes("/node_modules/sockjs-client/")) {
            return "realtime-vendor";
          }
        },
      },
    },
  },
});
