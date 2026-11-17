import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative Pfade, damit die App auch aus einem Unterordner (z. B. GitHub Pages) läuft.
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
