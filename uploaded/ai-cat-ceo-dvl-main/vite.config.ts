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
    // Böyük asılılıqları (firebase, supabase, xlsx) ayrı chunk-lara böl ki, ilk açılış sürətli olsun.
    // ÖNƏMLI: React və bütün react-əsaslı kitabxanalar (react-dom, react-router, react-i18next,
    // lucide-react, framer-motion, qrcode.react, react-signature-canvas) eyni "vendor-react"
    // chunk-ında olmalıdır. Əks halda runtime-də React undefined olur və "Cannot read
    // properties of undefined (reading 'useState')" xətası yaranır → ağ səhifə.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return;

          if (id.includes('firebase')) return 'vendor-firebase';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('xlsx')) return 'vendor-xlsx';
          if (id.includes('i18next') && !id.includes('react-i18next')) return 'vendor-i18n';

          // React core + bütün React-yiyəsi paketlər eyni chunk-da
          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|react-i18next|react-signature-canvas|qrcode\.react|lucide-react|framer-motion|@radix-ui|prop-types|use-sync-external-store)[\\/]/.test(
              id
            )
          ) {
            return 'vendor-react';
          }

          return 'vendor';
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
