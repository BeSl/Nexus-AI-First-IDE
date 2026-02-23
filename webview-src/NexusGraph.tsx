/**
 * NexusGraph — Blueprint/Unreal-style XState pipeline graph (React Flow).
 * Dark navy grid, cyan glowing nodes, animated wire edges, slide-in detail panel.
 * XState context bindings: currentState → currentAgent, status → pipelineStatus, error → lastError.
 * @security No eval — data flows via postMessage structural objects.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ReactFlow, Background, Controls, BackgroundVariant } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ExtensionMessage, NexusState } from './protocol.js';
import { vscodeApi } from './vscodeApi.js';
import { BlueprintNode } from './BlueprintNode.js';
import { BlueprintPanel, type PanelData } from './BlueprintPanel.js';
import { buildNodes, buildEdges, STATE_LABELS, PIPELINE } from './pipeline.config.js';
import { BP, BLUEPRINT_CSS } from './blueprint.styles.js';

// Stable reference — MUST be defined outside component to avoid React Flow re-mounts
const nodeTypes = { agent: BlueprintNode };
const TERMINAL  = new Set(['idle', 'done', 'failed', 'cancelled']);

// ── Blueprint toolbar ─────────────────────────────────────────────────────────

function BpHeader({ cur, state, running, onCancel }: {
  cur: string; state: NexusState | null; running: boolean; onCancel: () => void;
}) {
  const fail = cur === 'failed';
  const sClr = fail ? BP.nodeFailed : running ? BP.nodeActive : BP.textDim;
  return (
    <div style={{
      height: 44, padding: '0 16px', flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 10,
      background: BP.bg, borderBottom: `1px solid ${BP.nodeIdle}`,
      fontFamily: '"Courier New", monospace',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: BP.nodeActive }}>
        NEXUS
      </span>
      <span style={{ color: BP.nodeIdle, fontSize: 14, lineHeight: 1 }}>│</span>
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 2,
        background: `${sClr}18`, border: `1px solid ${sClr}55`,
        color: sClr, letterSpacing: 1,
      }}>
        {STATE_LABELS[cur] ?? cur}
      </span>
      <span style={{
        flex: 1, fontSize: 10, color: fail ? BP.nodeFailed : BP.textDim,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={fail ? state?.error : state?.intent}>
        {fail ? state?.error : state?.intent}
      </span>
      {running && (
        <button onClick={onCancel} style={{
          background: `${BP.nodeFailed}18`, border: `1px solid ${BP.nodeFailed}55`,
          color: BP.nodeFailed, borderRadius: 2, padding: '3px 12px',
          cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: 1,
        }}>ABORT</button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NexusGraph() {
  const [nexusState, setNexusState] = useState<NexusState | null>(null);
  const [panel, setPanel]           = useState<PanelData | null>(null);

  // Inject blueprint CSS keyframes once
  useEffect(() => {
    if (document.getElementById('bp-style')) return;
    const el = Object.assign(document.createElement('style'), {
      id: 'bp-style', textContent: BLUEPRINT_CSS,
    });
    document.head.appendChild(el);
  }, []);

  // Receive XState orchestrator snapshots from extension host
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

  // Stable callback — opens detail panel for clicked node
  const onSelect = useCallback((role: string, status: string) => {
    const node = PIPELINE.find((n) => n.id === role);
    setPanel(node ? { role, labelRu: node.labelRu, icon: node.icon, status } : null);
  }, []);

  const cur     = nexusState?.currentState ?? 'idle';
  const running = !TERMINAL.has(cur);

  // Memoize to avoid unnecessary React Flow diffing
  const nodes = useMemo(() => buildNodes(nexusState, onSelect), [nexusState, onSelect]);
  const edges = useMemo(() => buildEdges(nexusState), [nexusState]);

  return (
    <div style={{
      width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
      background: BP.bg,
    }}>
      <BpHeader cur={cur} state={nexusState} running={running} onCancel={onCancel} />

      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          fitView fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Lines}
            color={BP.nodeIdle} gap={40} size={1}
          />
          <Controls />
        </ReactFlow>

        {/* Slide-in detail panel — position: absolute over the graph */}
        <BlueprintPanel panel={panel} nexusState={nexusState} onClose={() => setPanel(null)} />
      </div>
    </div>
  );
}
