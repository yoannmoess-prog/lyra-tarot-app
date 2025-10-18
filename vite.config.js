import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  // Charge les variables d'env basées sur le mode (dev, prod)
  const env = loadEnv(mode, process.cwd(), '');

  const serverConfig = {
    host: true,
    port: 5173,
  };

  // En mode développement, on configure un proxy pour les appels API
  // afin d'éviter les problèmes de CORS.
  if (mode === 'development') {
    serverConfig.proxy = {
      // Toutes les requêtes commençant par /api sont redirigées
      '/api': {
        // vers le backend qui tourne sur le port 8787
        target: 'http://localhost:8787',
        // Nécessaire pour les hôtes virtuels
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
      // Injecte la variable d'environnement dans le code client.
      // En production, cette valeur viendra des secrets configurés sur Render.
      // En développement, elle viendra du fichier .env.
      'process.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL)
    }
  };
});