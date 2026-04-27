import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['lucide-react'],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    // Slow file-change detection so the page doesn't auto-refresh while browsing.
    // Vite will only check for code changes every 2 minutes.
    watch: {
      usePolling: true,
      interval: 120000,
      binaryInterval: 120000,
    },
  },
});
