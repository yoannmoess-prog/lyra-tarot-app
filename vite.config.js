import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const serverConfig = {
    host: true,
    port: 5173,
  };

  if (mode === 'development') {
    serverConfig.proxy = {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    };
  }

  return {
    plugins: [react()],
    resolve: {
      alias: { "@": path.resolve(process.cwd(), "./src") },
    },
    server: serverConfig,
    define: {
      'process.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL)
    }
  };
});