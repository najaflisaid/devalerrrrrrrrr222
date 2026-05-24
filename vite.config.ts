import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['lucide-react', 'react', 'react-dom', 'react-router-dom', 'framer-motion'],
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    // Böyük asılılıqları (firebase, supabase, xlsx) ayrı chunk-lara böl ki, ilk açılış sürətli olsun
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('react-i18next') || id.includes('i18next')) return 'vendor-i18n';
            if (id.includes('react')) return 'vendor-react';
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
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
