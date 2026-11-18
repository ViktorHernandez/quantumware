import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const RUTAS_API =
  '^/(salud|productos|pedidos|perfil|usuarios|movimientos|dashboard|notificaciones)(/.*)?$';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      [RUTAS_API]: {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mantine: ['@mantine/core', '@mantine/hooks', '@mantine/notifications'],
          iconos: ['@tabler/icons-react'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
