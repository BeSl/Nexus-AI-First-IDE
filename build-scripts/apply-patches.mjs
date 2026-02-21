/**
 * Apply Nexus Agent IDE patches to vscode-src.
 * Patches live in /patches/*.patch — applied in order.
 *
 * Patch naming convention:
 *   NNNN-scope-description.patch
 *   e.g. 0001-branding-remove-telemetry.patch
 *        0002-nexus-add-agent-panel.patch
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const VSCODE_DIR = resolve(ROOT, 'vscode-src');
const PATCHES_DIR = resolve(ROOT, 'patches');

if (!existsSync(VSCODE_DIR)) {
  console.error('❌ vscode-src not found. Run: npm run vscode:clone');
  process.exit(1);
}

const patches = readdirSync(PATCHES_DIR)
  .filter(f => f.endsWith('.patch'))
  .sort();

if (patches.length === 0) {
  console.log('ℹ️  No patches to apply yet.');
  process.exit(0);
}

console.log(`\n🔧 Applying ${patches.length} patch(es) to vscode-src...\n`);

for (const patch of patches) {
  const patchPath = resolve(PATCHES_DIR, patch);
  try {
    execSync(`git apply --check "${patchPath}"`, { cwd: VSCODE_DIR });
    execSync(`git apply "${patchPath}"`, { cwd: VSCODE_DIR });
    console.log(`  ✅ ${patch}`);
  } catch {
    console.error(`  ❌ Failed: ${patch}`);
    process.exit(1);
  }
}

console.log('\n🎉 All patches applied.');
