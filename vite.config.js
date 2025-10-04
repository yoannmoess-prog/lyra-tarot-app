// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") }
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // garde/retire ces proxys selon ton backend
      "/api":     "http://localhost:8787",
      "/session": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/metrics": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/healthz": { target: "http://127.0.0.1:8787", changeOrigin: true }
    }
  }
});