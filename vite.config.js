import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // accès depuis le téléphone
    port: 5173,
    proxy: {
      "/api":     { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/session": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/metrics": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/healthz": { target: "http://127.0.0.1:8787", changeOrigin: true },
    },
  },
});