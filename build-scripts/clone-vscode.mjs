/**
 * Clone the vscode (Code-OSS) source for local patching.
 * This mirrors the VSCodium build approach — we keep vscode source
 * separate and apply our patches on top.
 *
 * Usage: node build-scripts/clone-vscode.mjs [--tag <version>]
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const VSCODE_DIR = resolve(ROOT, 'vscode-src');

// Read target vscode version from version config
const VERSION_FILE = resolve(ROOT, 'build-scripts/vscode-version.json');
const { tag, sha } = JSON.parse(readFileSync(VERSION_FILE, 'utf-8'));

console.log(`\n🔧 Nexus Agent IDE — VSCode Source Setup`);
console.log(`   Target: microsoft/vscode @ ${tag}\n`);

if (existsSync(VSCODE_DIR)) {
  console.log('✅ vscode-src already exists. Run with --force to re-clone.');
  const currentTag = execSync('git describe --tags', { cwd: VSCODE_DIR }).toString().trim();
  console.log(`   Current: ${currentTag}`);
  process.exit(0);
}

try {
  // Shallow clone for speed — we only need the specific tag
  console.log('📦 Cloning microsoft/vscode (shallow)...');
  execSync(
    `git clone --depth 1 --branch ${tag} https://github.com/microsoft/vscode.git ${VSCODE_DIR}`,
    { stdio: 'inherit', cwd: ROOT }
  );

  // Verify SHA matches
  const clonedSha = execSync('git rev-parse HEAD', { cwd: VSCODE_DIR }).toString().trim();
  if (sha && clonedSha !== sha) {
    console.warn(`⚠️  SHA mismatch: expected ${sha}, got ${clonedSha}`);
  } else {
    console.log(`✅ Verified SHA: ${clonedSha}`);
  }

  console.log('\n🎉 vscode-src ready. Run: npm run patch:apply');
} catch (err) {
  console.error('❌ Clone failed:', err.message);
  process.exit(1);
}
