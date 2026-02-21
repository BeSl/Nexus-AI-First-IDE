import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'core/**/*.spec.ts',
      'agents/**/*.spec.ts',
      'agent-ts/**/*.spec.ts',
      'src/**/*.spec.ts',
    ],
    exclude: [
      'vscode-src/**',
      'node_modules/**',
      'dist/**',
    ],
  },
});
