import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // ... potentiellement d'autres plugins comme react() ou vue()  
  server: {
    allowedHosts: [
      'usm-tournois.moka-web.net'
    ]
  }
});
