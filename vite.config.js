import { defineConfig } from 'vite';

export default defineConfig({
  // Saved pages live in ./pages. Without this, every autosave would make Vite reload the editor.
  server: { watch: { ignored: ['**/pages/**'] } },
  optimizeDeps: { entries: ['index.html'] },
  build: { chunkSizeWarningLimit: 2000 },
});
