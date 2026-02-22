/**
 * AgentNode — Custom React Flow node rendered for each Nexus pipeline step.
 *
 * Displays: icon, Russian label, status badge, optional duration.
 * Border/glow color signals status (active=blue, done=green, failed=red, pending=dim).
 *
 * @security No dynamic code — data flows only from postMessage.
 */

import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export type NodeStatus = 'idle' | 'pending' | 'active' | 'done' | 'failed';

export interface AgentNodeData extends Record<string, unknown> {
  labelRu: string;
  icon: string;
  status: NodeStatus;
  durationMs?: number;
}

const BORDER: Record<NodeStatus, string> = {
  idle:    'var(--vscode-panel-border, #3c3c3c)',
  pending: 'var(--vscode-panel-border, #3c3c3c)',
  active:  'var(--vscode-focusBorder, #007acc)',
  done:    '#2ea043',
  failed:  '#da3633',
};

const STATUS_TEXT: Record<NodeStatus, string> = {
  idle:    'Ожидание',
  pending: 'В очереди',
  active:  '▶ Работает',
  done:    '✓ Готово',
  failed:  '✗ Ошибка',
};

const STATUS_COLOR: Record<NodeStatus, string> = {
  idle:    '#666',
  pending: '#555',
  active:  'var(--vscode-focusBorder, #007acc)',
  done:    '#2ea043',
  failed:  '#da3633',
};

export function AgentNode({ data }: NodeProps) {
  const { labelRu, icon, status = 'pending', durationMs } = data as AgentNodeData;
  const s = status as NodeStatus;
  const isActive = s === 'active';

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
      <div style={{
        background: 'var(--vscode-editor-background, #1e1e1e)',
        border: `2px solid ${BORDER[s]}`,
        borderRadius: 10,
        padding: '12px 16px',
        minWidth: 130,
        textAlign: 'center' as const,
        boxShadow: isActive
          ? `0 0 0 3px ${BORDER.active}55, 0 4px 20px #0006`
          : '0 2px 8px #0004',
        opacity: s === 'pending' ? 0.45 : 1,
        transition: 'box-shadow 0.4s, opacity 0.3s',
      }}>
        <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 6 }}>{icon}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--vscode-foreground, #ccc)', marginBottom: 5 }}>
          {labelRu}
        </div>
        <div style={{ fontSize: 10, color: STATUS_COLOR[s], fontWeight: isActive ? 600 : 400 }}>
          {STATUS_TEXT[s]}
        </div>
        {durationMs != null && (
          <div style={{ fontSize: 9, color: '#555', marginTop: 3 }}>
            {(durationMs / 1000).toFixed(1)}s
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
    </>
  );
}
