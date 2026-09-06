import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const threeLicense = readFileSync(new URL('./node_modules/three/LICENSE', import.meta.url), 'utf8');

export default defineConfig({
  build: {
    outDir: 'dist/component',
    emptyOutDir: false,
    lib: { entry: 'src/slimey-goo.js', formats: ['es'], fileName: () => 'slimey-goo.js' },
    rolldownOptions: {
      external: ['three'],
      output: { banner: '/*! Bundled Three.js addons:\n' + threeLicense + '\n*/' },
    },
  },
});
