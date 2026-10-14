import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const basePath = env.VITE_BASE_PATH?.replace(/^\/+|\/+$/g, "");
  const base = basePath ? `/${basePath}/` : "/";

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["moviehub-icon.svg", "moviehub-icon-180.png"],
        manifest: {
          name: "MovieHub Local",
          short_name: "MovieHub",
          description: "Browse and play your local movie library in your browser.",
          theme_color: "#09090b",
          background_color: "#09090b",
          display: "standalone",
          start_url: base,
          scope: base,
          icons: [
            {
              src: `${base}moviehub-icon-192.png`,
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: `${base}moviehub-icon-512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
  };
});
