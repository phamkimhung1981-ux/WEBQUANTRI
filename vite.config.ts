import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const buildTimestamp = new Date().toISOString();
const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'dev-' + Date.now().toString(36);
const buildEnv = process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development');

export default defineConfig(() => {
  return {
    define: {
      __BUILD_TIME__: JSON.stringify(buildTimestamp),
      __COMMIT_SHA__: JSON.stringify(commitSha),
      __APP_ENV__: JSON.stringify(buildEnv),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('xlsx') || id.includes('docx') || id.includes('mammoth') || id.includes('html2pdf') || id.includes('jspdf') || id.includes('html2canvas')) {
                return 'vendor-office';
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('recharts') || id.includes('d3-')) {
                return 'vendor-charts';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              return 'vendor-core';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
