import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
        theme_color: "#f34343",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",

        icons: [
          {
            src: "/icons/logo.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/logo.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/logo-maskable.png",
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
            handler: "NetworkFirst",
            options: {
              cacheName: "bien-criollas-api",
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 5,
              },
            },
          },
        ],
      },
    }),
  ],
});
