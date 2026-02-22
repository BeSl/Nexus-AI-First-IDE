/**
 * NexusGraph — Nexus Pipeline Visualizer (React Flow)
 *
 * Shows each agent as a card node. Active edge animates.
 * MiniMap in corner for navigation. Header shows current task intent.
 *
 * @security No eval — all data flows via postMessage structural objects.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, MarkerType, BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ExtensionMessage, NexusState } from './protocol.js';
import { vscodeApi } from './vscodeApi.js';
import { AgentNode, type NodeStatus } from './AgentNode.js';

// ── Static config ─────────────────────────────────────────────────────────────

const nodeTypes = { agent: AgentNode };

const PIPELINE = [
  { id: 'idle',             labelRu: 'Старт',         icon: '🚀', x: 0    },
  { id: 'architect',        labelRu: 'Архитектор',    icon: '🏗',  x: 210  },
  { id: 'awaitingApproval', labelRu: 'Согласование',  icon: '✋',  x: 420  },
  { id: 'coder',            labelRu: 'Кодер',         icon: '💻', x: 630  },
  { id: 'reviewer',         labelRu: 'Ревьюер',       icon: '🔍', x: 840  },
  { id: 'tester',           labelRu: 'Тестер',        icon: '🧪', x: 1050 },
  { id: 'done',             labelRu: 'Готово',        icon: '🎉', x: 1260 },
] as const;

const SPECIAL = [
  { id: 'failed',    labelRu: 'Ошибка',   icon: '💥', x: 630, y: 210 },
  { id: 'cancelled', labelRu: 'Отменено', icon: '⛔', x: 420, y: 210 },
] as const;

const PIPELINE_ORDER = PIPELINE.map((n) => n.id);

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveStatus(id: string, state: NexusState | null): NodeStatus {
  const cur = state?.currentState ?? 'idle';
  if (id === cur) return id === 'failed' || id === 'cancelled' ? 'failed' : id === 'done' ? 'done' : 'active';
  if (id === 'failed' || id === 'cancelled') return 'pending';
  const prog = state?.progress?.find((p) => p.role === id);
  if (prog?.status === 'done')   return 'done';
  if (prog?.status === 'active') return 'active';
  if (prog?.status === 'failed') return 'failed';
  const ci = PIPELINE_ORDER.indexOf(cur as typeof PIPELINE_ORDER[number]);
  const ni = PIPELINE_ORDER.indexOf(id as typeof PIPELINE_ORDER[number]);
  return ni >= 0 && ci >= 0 && ni < ci ? 'done' : 'pending';
}

function buildNodes(state: NexusState | null): Node[] {
  const durationMap = new Map(state?.progress?.map((p) => [p.role, p.durationMs]));
  const mainNodes: Node[] = PIPELINE.map((n) => ({
    id: n.id, type: 'agent',
    position: { x: n.x, y: 0 },
    data: { labelRu: n.labelRu, icon: n.icon, status: resolveStatus(n.id, state), durationMs: durationMap.get(n.id as never) },
  }));
  const specialNodes: Node[] = SPECIAL.map((n) => ({
    id: n.id, type: 'agent',
    position: { x: n.x, y: n.y },
    data: { labelRu: n.labelRu, icon: n.icon, status: n.id === state?.currentState ? 'failed' : 'pending' },
  }));
  return [...mainNodes, ...specialNodes];
}

function buildEdges(state: NexusState | null): Edge[] {
  const cur = state?.currentState ?? 'idle';
  const mk = { markerEnd: { type: MarkerType.ArrowClosed } };

  const main: Edge[] = PIPELINE.slice(0, -1).map((n, i) => ({
    id: `${n.id}->${PIPELINE[i + 1]!.id}`, source: n.id, target: PIPELINE[i + 1]!.id,
    ...mk, animated: cur === n.id,
    style: { stroke: cur === n.id ? '#007acc' : '#444' },
  }));

  const errors: Edge[] = ['architect', 'coder', 'reviewer', 'tester'].flatMap((s) => [
    { id: `${s}->failed`,    source: s, target: 'failed',    ...mk, style: { stroke: '#333', strokeDasharray: '4 3' } },
    { id: `${s}->cancelled`, source: s, target: 'cancelled', ...mk, style: { stroke: '#333', strokeDasharray: '4 3' } },
  ]);

  return [...main, ...errors,
    { id: 'await->idle', source: 'awaitingApproval', target: 'idle',
      label: 'отклонено', ...mk, style: { stroke: '#444', strokeDasharray: '4 3' } },
  ];
}

// ── State label map ───────────────────────────────────────────────────────────

const STATE_LABELS: Record<string, string> = {
  idle: 'Ожидание', architect: 'Архитектор', awaitingApproval: 'Согласование',
  coder: 'Кодер', reviewer: 'Ревьюер', tester: 'Тестер',
  done: 'Готово ✓', failed: 'Ошибка ✗', cancelled: 'Отменено',
};

// ── Main component ────────────────────────────────────────────────────────────

export function NexusGraph() {
  const [nexusState, setNexusState] = useState<NexusState | null>(null);

  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      const msg = ev.data as ExtensionMessage;
      if (msg.type === 'orchestrator:state') setNexusState((msg as { state: NexusState }).state);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const onCancel = useCallback(() => {
    if (nexusState?.taskId) vscodeApi.postMessage({ type: 'user:cancel', taskId: nexusState.taskId });
  }, [nexusState]);

  const cur = nexusState?.currentState ?? 'idle';
  const running = cur !== 'idle' && cur !== 'done' && cur !== 'failed' && cur !== 'cancelled';

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--vscode-editor-background, #1e1e1e)' }}>

      {/* Header */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--vscode-panel-border, #3c3c3c)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, minHeight: 38 }}>
        <span style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
          Nexus
        </span>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
          background: running ? '#007acc1a' : '#3c3c3c', color: running ? '#007acc' : '#777',
          border: `1px solid ${running ? '#007acc44' : '#444'}` }}>
          {STATE_LABELS[cur] ?? cur}
        </span>
        {nexusState?.intent && (
          <span style={{ fontSize: 11, color: '#666', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {nexusState.intent}
          </span>
        )}
        {running && (
          <button onClick={onCancel} style={{ marginLeft: 'auto', background: '#b91c1c', color: '#fff',
            border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 11 }}>
            Отмена
          </button>
        )}
      </div>

      {/* Graph */}
      <div style={{ flex: 1 }}>
        <ReactFlow nodes={buildNodes(nexusState)} edges={buildEdges(nexusState)}
          nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.3 }}>
          <Background color="#2a2a2a" variant={BackgroundVariant.Dots} />
          <Controls />
          <MiniMap nodeColor="#3c3c3c" maskColor="#1a1a1aaa" style={{ background: '#252526' }} />
        </ReactFlow>
      </div>
    </div>
  );
}
