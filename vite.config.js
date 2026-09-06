import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const raw = process.env.BASE_PATH ?? "/";
const base = raw.trim().startsWith("/") ? raw : `/${raw}`;

export default defineConfig({
  base: base === "/" ? "/" : `${base.replace(/\/+$/, "")}/`,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["fonts/*.woff2", "icons/*.svg", "icons/*.png"],
      manifest: {
        name: "Serpentine Arcade",
        short_name: "Serpentine",
        description: "Eight playable arcade classics in one browser — Snake, Block Twist, Breakout, Invaders, Pong, Asteroids, Minesweeper and Memory.",
        lang: "en",
        display: "fullscreen",
        start_url: ".",
        scope: ".",
        theme_color: "#06110c",
        background_color: "#06110c",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,svg,png}"],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/sw\.js$/, /manifest\.webmanifest$/],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});