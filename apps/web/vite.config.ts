import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  // GitHub Pages serve em /<repo>/; defina VITE_BASE=/chrise/ no build da demo.
  base: process.env.VITE_BASE ?? "/",
  server: { host: true, port: 8080 },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Chrise — finanças sem crise",
        short_name: "Chrise",
        description: "Controle financeiro preditivo para quem é PJ.",
        lang: "pt-BR",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f0e0d",
        theme_color: "#0f0e0d",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Novo lançamento", short_name: "Lançar", url: "./?new=1" },
          { name: "Impostos do mês", short_name: "Impostos", url: "./taxes" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            // Leituras do Supabase: rede primeiro, cache como fallback offline.
            urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/rest/"),
            handler: "NetworkFirst",
            method: "GET",
            options: { cacheName: "supabase-rest", networkTimeoutSeconds: 4, expiration: { maxEntries: 100, maxAgeSeconds: 7 * 86400 } },
          },
        ],
      },
    }),
  ],
  build: {
    // es2022: permite top-level await (usado para carregar o Supabase só em produção).
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
          charts: ["recharts"],
        },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
