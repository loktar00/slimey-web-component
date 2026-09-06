import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    watch: { awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 25 } },
  },
});
