/**
 * build.mjs — Nexus Agent IDE build script
 *
 * Bundles the React Flow webview (webview-src/) into dist/webview/index.js
 * using esbuild. The extension host TypeScript is compiled separately via tsc.
 *
 * Usage: node build-scripts/build.mjs
 */

import { build } from 'esbuild';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function buildWebview() {
  await mkdir(path.join(root, 'dist', 'webview'), { recursive: true });

  await build({
    entryPoints: [path.join(root, 'webview-src', 'main.tsx')],
    bundle: true,
    outfile: path.join(root, 'dist', 'webview', 'index.js'),
    platform: 'browser',
    format: 'iife',
    target: 'es2020',
    minify: process.env['NODE_ENV'] === 'production',
    sourcemap: true,
    jsx: 'automatic',
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env['NODE_ENV'] ?? 'development'),
    },
  });
  console.log('✓ Webview bundle → dist/webview/index.js');
}

buildWebview().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
