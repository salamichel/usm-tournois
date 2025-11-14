import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // or vue(), etc.

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()], // Your other plugins
  
  // Add this 'server' section
  server: {
    allowedHosts: [
      'usm-tournois.moka-web.net'
    ]
  }
});
