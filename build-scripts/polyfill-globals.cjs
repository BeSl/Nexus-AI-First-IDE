/**
 * polyfill-globals.cjs
 * Polyfills `globalThis.File` for Node 18 compatibility.
 * `File` was added to Node as a global in v20; on v18 it lives in `node:buffer`.
 * Used by: npm run package (vsce → undici v7 requires globalThis.File)
 */
if (typeof globalThis.File === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { File } = require('node:buffer');
  globalThis.File = File;
}
