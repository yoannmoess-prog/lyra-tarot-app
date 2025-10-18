import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  let apiBaseUrl;

  // En production, l'URL du backend est inscrite en dur pour garantir la connexion.
  if (mode === 'production') {
    apiBaseUrl = 'https://lyra-backend-3lxf.onrender.com/api';
  } else {
    // En développement, on utilise un chemin relatif pour le proxy.
    apiBaseUrl = '/api';
  }

  const serverConfig = {
    host: true,
    port: 5173,
    proxy:
      mode === 'development'
        ? {
            '/api': {
              target: 'http://localhost:8787',
              changeOrigin: true,
            },
          }
        : undefined,
  };

  return {
    plugins: [react()],
    resolve: {
      alias: { "@": path.resolve(process.cwd(), "./src") },
    },
    server: serverConfig,
    define: {
      // Injecte la bonne URL de l'API dans le code du client.
      'process.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl)
    }
  };
});