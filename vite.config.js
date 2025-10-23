import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Configuration du proxy unique et fiable
const proxyConfig = {
  '/api': {
    target: 'https://lyra-backend-3lxf.onrender.com',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "./src") },
  },
  server: {
    host: true,
    port: 5173,
    proxy: proxyConfig, // Utilise le proxy en développement
  },
});
