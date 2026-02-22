/**
 * Webview entry point — mounts NexusGraph into #root.
 * Bundled by esbuild (IIFE) and loaded by NexusGraphPanel.
 * @security No external network calls — all data from VS Code postMessage.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { NexusGraph } from './NexusGraph.js';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<NexusGraph />);
}
