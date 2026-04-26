import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['js/**/*.js'],
      exclude: [
        'js/changelog-data.js',  // données pures, pas de logique
        'js/config.js'           // constantes
      ],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage'
    }
  }
});
