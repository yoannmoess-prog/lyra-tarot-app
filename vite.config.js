import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Définition de l'URL de l'API en fonction de l'environnement
  const VITE_API_BASE_URL = (mode === 'production')
    ? 'https://lyra-backend-3lxf.onrender.com/api'
    : '/api';

  const serverConfig = {
    host: true,
    port: 5173,
  };

  // Le proxy n'est actif qu'en mode développement
  if (mode === 'development') {
    serverConfig.proxy = {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
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
      // Injecte la variable d'environnement dans le code client
      'process.env.VITE_API_BASE_URL': JSON.stringify(VITE_API_BASE_URL)
    }
  };
});