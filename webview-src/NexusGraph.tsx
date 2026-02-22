/**
 * NexusGraph — XState Orchestrator Visualizer (React Flow)
 *
 * Renders the Nexus Loop pipeline as an interactive DAG.
 * Current state is highlighted; progress bars show agent status.
 *
 * @security No eval — all data from postMessage is structural only.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { AgentProgress, ExtensionMessage, NexusState } from './protocol.js';
import { vscodeApi } from './vscodeApi.js';

// ── Static DAG layout ─────────────────────────────────────────────────────────

const STATE_ORDER = ['idle', 'architect', 'awaitingApproval', 'coder', 'reviewer', 'tester', 'done'] as const;
const TERMINAL = ['failed', 'cancelled'] as const;

const LABELS: Record<string, string> = {
  idle: 'Idle', architect: 'Architect', awaitingApproval: 'Awaiting\nApproval',
  coder: 'Coder', reviewer: 'Reviewer', tester: 'Tester',
  done: 'Done ✓', failed: 'Failed ✗', cancelled: 'Cancelled',
};

function nodeColor(id: string, current: string): string {
  if (id === current) return 'var(--vscode-button-background, #0078d4)';
  if (id === 'done' && current === 'done') return '#2ea043';
  if (id === 'failed' && current === 'failed') return '#da3633';
  return '#3c3c3c';
}

function buildNodes(currentState: string): Node[] {
  const main: Node[] = STATE_ORDER.map((id, i) => ({
    id,
    position: { x: i * 170, y: 100 },
    data: { label: LABELS[id] ?? id },
    style: {
      background: nodeColor(id, currentState),
      color: '#fff', borderRadius: 6, padding: '8px 14px',
      border: id === currentState ? '2px solid #fff' : '1px solid #555',
      fontSize: 12, whiteSpace: 'pre',
    },
  }));
  return [
    ...main,
    { id: 'failed', position: { x: 4 * 170, y: 240 }, data: { label: LABELS.failed },
      style: { background: nodeColor('failed', currentState), color: '#fff', borderRadius: 6,
        padding: '8px 14px', border: '1px solid #555', fontSize: 12 } },
    { id: 'cancelled', position: { x: 2 * 170, y: 240 }, data: { label: LABELS.cancelled },
      style: { background: nodeColor('cancelled', currentState), color: '#fff', borderRadius: 6,
        padding: '8px 14px', border: '1px solid #555', fontSize: 12 } },
  ];
}

const EDGES: Edge[] = [
  ...STATE_ORDER.slice(0, -1).map((s, i) => ({
    id: `${s}->${STATE_ORDER[i + 1]}`, source: s, target: STATE_ORDER[i + 1]!,
    markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#888' },
  })),
  { id: 'await->idle', source: 'awaitingApproval', target: 'idle', label: 'reject',
    style: { stroke: '#888' }, markerEnd: { type: MarkerType.ArrowClosed } },
  ...['architect', 'coder', 'reviewer', 'tester'].map((s) => ({
    id: `${s}->failed`, source: s, target: 'failed',
    style: { stroke: '#555', strokeDasharray: '4' }, markerEnd: { type: MarkerType.ArrowClosed },
  })),
  ...['architect', 'coder', 'reviewer', 'tester'].map((s) => ({
    id: `${s}->cancelled`, source: s, target: 'cancelled',
    style: { stroke: '#555', strokeDasharray: '4' }, markerEnd: { type: MarkerType.ArrowClosed },
  })),
];

// ── Progress sidebar ──────────────────────────────────────────────────────────

function ProgressBar({ progress }: { readonly progress: readonly AgentProgress[] }) {
  if (progress.length === 0) return null;
  return (
    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10,
      background: 'rgba(30,30,30,0.9)', padding: 12, borderRadius: 6, minWidth: 160 }}>
      <div style={{ color: '#ccc', fontSize: 11, marginBottom: 6 }}>Agent Progress</div>
      {progress.map((p) => (
        <div key={p.role} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: '#999', width: 70 }}>{p.role}</span>
          <span style={{ fontSize: 10, color: STATUS_COLOR[p.status] }}>{p.status}</span>
          {p.durationMs != null && (
            <span style={{ fontSize: 9, color: '#555' }}>{p.durationMs}ms</span>
          )}
        </div>
      ))}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#666', active: '#0078d4', done: '#2ea043', failed: '#da3633',
};

// ── Main component ────────────────────────────────────────────────────────────

export function NexusGraph() {
  const [nexusState, setNexusState] = useState<NexusState | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as ExtensionMessage;
      if (msg.type === 'orchestrator:state') {
        setNexusState((msg as { state: NexusState }).state);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const onCancel = useCallback(() => {
    if (nexusState?.taskId) {
      vscodeApi.postMessage({ type: 'user:cancel', taskId: nexusState.taskId });
    }
  }, [nexusState]);

  const currentState = nexusState?.currentState ?? 'idle';
  const nodes = buildNodes(currentState);

  return (
    <div style={{ width: '100%', height: '100vh', background: 'var(--vscode-editor-background, #1e1e1e)' }}>
      <ReactFlow nodes={nodes} edges={EDGES} fitView>
        <Background color="#333" />
        <Controls />
      </ReactFlow>
      <ProgressBar progress={nexusState?.progress ?? []} />
      {nexusState && !TERMINAL.includes(nexusState.currentState as typeof TERMINAL[number]) && (
        <button onClick={onCancel} style={{
          position: 'absolute', bottom: 16, right: 16, zIndex: 10,
          background: '#c72e2e', color: '#fff', border: 'none',
          borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 12,
        }}>Cancel</button>
      )}
    </div>
  );
}
