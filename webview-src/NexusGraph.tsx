/**
 * NexusGraph — Nexus Pipeline Visualizer (React Flow).
 *
 * Renders XState orchestrator states as a linear horizontal pipeline.
 * Active step is highlighted with a pulsing CSS glow animation.
 * Error details are surfaced in the header and as a node tooltip.
 *
 * Pipeline: idle → architect → awaitingApproval → coder → shadowBuild → reviewer → tester → done
 *
 * @security No eval — all data flows via postMessage structural objects.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ExtensionMessage, NexusState } from './protocol.js';
import { vscodeApi } from './vscodeApi.js';
import { AgentNode } from './AgentNode.js';
import { buildNodes, buildEdges, STATE_LABELS } from './pipeline.config.js';

// Stable reference — MUST be defined outside the component
const nodeTypes = { agent: AgentNode };

// CSS keyframe injected once into document <head>
const PULSE_CSS = `
  @keyframes nexus-active-pulse {
    0%   { box-shadow: 0 0 0 0px  rgba(0,122,204,.45); }
    65%  { box-shadow: 0 0 0 10px rgba(0,122,204,0);   }
    100% { box-shadow: 0 0 0 0px  rgba(0,122,204,0);   }
  }
  .nexus-node-active { animation: nexus-active-pulse 1.6s ease-out infinite; }
`;

const TERMINAL = new Set(['idle', 'done', 'failed', 'cancelled']);

// ── Header sub-component ──────────────────────────────────────────────────────

function PipelineHeader({
  cur, state, running, onCancel,
}: {
  cur: string; state: NexusState | null; running: boolean; onCancel: () => void;
}) {
  const fail = cur === 'failed';
  const pillBg = fail
    ? 'var(--vscode-inputValidation-errorBackground, #5a1d1d)'
    : running ? 'var(--vscode-editorInfo-background, #007acc1a)' : 'transparent';
  const pillFg = fail
    ? 'var(--vscode-errorForeground, #da3633)'
    : running ? 'var(--vscode-focusBorder, #007acc)' : 'var(--vscode-descriptionForeground, #888)';

  return (
    <div style={{
      height: 42, padding: '0 16px', flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 10,
      borderBottom: '1px solid var(--vscode-panel-border, #3c3c3c)',
    }}>
      {/* Brand */}
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
        color: 'var(--vscode-descriptionForeground, #555)',
      }}>Nexus</span>

      {/* State pill */}
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 10,
        background: pillBg, color: pillFg,
        border: `1px solid ${pillFg}44`,
      }}>
        {STATE_LABELS[cur] ?? cur}
      </span>

      {/* Intent / error text (flex: 1 keeps it from pushing Cancel off-screen) */}
      <span style={{
        flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: fail
          ? 'var(--vscode-errorForeground, #da3633)'
          : 'var(--vscode-descriptionForeground, #666)',
      }} title={fail ? state?.error : state?.intent}>
        {fail ? state?.error : state?.intent}
      </span>

      {/* Cancel button */}
      {running && (
        <button onClick={onCancel} style={{
          border: 'none', borderRadius: 4, padding: '3px 12px',
          cursor: 'pointer', fontSize: 11, fontWeight: 600,
          background: 'var(--vscode-button-secondaryBackground, #3c3c3c)',
          color:      'var(--vscode-button-secondaryForeground, #ccc)',
        }}>
          Отмена
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NexusGraph() {
  const [nexusState, setNexusState] = useState<NexusState | null>(null);

  // Inject pulsing glow keyframe once
  useEffect(() => {
    if (document.getElementById('nexus-pulse-style')) return;
    const el = Object.assign(document.createElement('style'), {
      id: 'nexus-pulse-style', textContent: PULSE_CSS,
    });
    document.head.appendChild(el);
  }, []);

  // Receive orchestrator snapshots from the extension host
  useEffect(() => {
    const h = (ev: MessageEvent) => {
      const msg = ev.data as ExtensionMessage;
      if (msg.type === 'orchestrator:state')
        setNexusState((msg as { state: NexusState }).state);
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  const onCancel = useCallback(() => {
    if (nexusState?.taskId)
      vscodeApi.postMessage({ type: 'user:cancel', taskId: nexusState.taskId });
  }, [nexusState]);

  const cur     = nexusState?.currentState ?? 'idle';
  const running = !TERMINAL.has(cur);

  return (
    <div style={{
      width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--vscode-editor-background, #1e1e1e)',
    }}>
      <PipelineHeader cur={cur} state={nexusState} running={running} onCancel={onCancel} />

      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={buildNodes(nexusState)}
          edges={buildEdges(nexusState)}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots}
            color="var(--vscode-widget-border, #2a2a2a)" gap={24} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(n) =>
              n.data?.status === 'active' ? '#007acc'
              : n.data?.status === 'done'   ? '#2ea043' : '#3c3c3c'
            }
            maskColor="var(--vscode-editor-background, #1e1e1e)bb"
            style={{ background: 'var(--vscode-sideBar-background, #252526)' }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
