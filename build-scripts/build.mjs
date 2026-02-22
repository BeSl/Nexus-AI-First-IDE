/**
 * build.mjs — Nexus Agent IDE build script
 *
 * 1. Bundles the extension host (src/extension.ts + all deps) into
 *    dist/extension.js — a single CJS file with node_modules inlined.
 *    vscode is marked external (provided by VS Code runtime).
 *
 * 2. Bundles the React Flow webview (webview-src/) into
 *    dist/webview/index.js for the browser sandbox.
 *
 * Usage: node build-scripts/build.mjs
 */

import { build } from 'esbuild';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const prod = process.env['NODE_ENV'] === 'production';

// ── Extension host bundle ─────────────────────────────────────────────────────

async function buildExtensionHost() {
  await build({
    entryPoints: [path.join(root, 'src', 'extension.ts')],
    bundle: true,
    outfile: path.join(root, 'dist', 'extension.js'),
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    // vscode is injected at runtime by VS Code — never bundle it
    external: ['vscode'],
    minify: prod,
    sourcemap: !prod,
    // Resolve .js imports to .ts sources (TypeScript convention)
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  });
  console.log('✓ Extension host bundle → dist/extension.js');
}

// ── Webview bundle ────────────────────────────────────────────────────────────

async function buildWebview() {
  await mkdir(path.join(root, 'dist', 'webview'), { recursive: true });

  await build({
    entryPoints: [path.join(root, 'webview-src', 'main.tsx')],
    bundle: true,
    outfile: path.join(root, 'dist', 'webview', 'index.js'),
    platform: 'browser',
    format: 'iife',
    target: 'es2020',
    minify: prod,
    sourcemap: !prod,
    jsx: 'automatic',
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env['NODE_ENV'] ?? 'development'),
    },
  });
  console.log('✓ Webview bundle      → dist/webview/index.js');
}

// ── Run both ──────────────────────────────────────────────────────────────────

Promise.all([buildExtensionHost(), buildWebview()]).catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
