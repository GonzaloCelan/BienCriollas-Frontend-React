import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      manifest: {
        name: "Bien Criollas",
        short_name: "Bien Criollas",
        description: "Sistema de gestión para Bien Criollas",
        theme_color: "#f34343",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "landscape",
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
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
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