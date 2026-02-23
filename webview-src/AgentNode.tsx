/**
 * AgentNode — Custom React Flow node for the Nexus pipeline.
 *
 * Visual language:
 *   active  → pulsing blue glow (.nexus-node-active, keyframes injected by NexusGraph)
 *   done    → green border + ✓ corner badge
 *   failed  → red border + ✕ corner badge + title tooltip with error text
 *   pending → dimmed (opacity 0.4)
 *
 * Uses only VS Code native CSS variables — adapts to Light and Dark themes.
 * @security No eval — data flows via postMessage structural objects only.
 */

import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export type NodeStatus = 'idle' | 'pending' | 'active' | 'done' | 'failed';

export interface AgentNodeData extends Record<string, unknown> {
  labelRu:     string;
  icon:        string;
  status:      NodeStatus;
  durationMs?: number;
  /** Error description shown in title tooltip when status === 'failed' */
  errorMsg?:   string;
  /** Retry counter label shown on shadowBuild node during retries */
  retryLabel?: string;
}

// ── Theme maps (VS Code CSS variables with safe hex fallbacks) ────────────────

const BORDER: Record<NodeStatus, string> = {
  idle:    'var(--vscode-widget-border, #3c3c3c)',
  pending: 'var(--vscode-widget-border, #3c3c3c)',
  active:  'var(--vscode-focusBorder, #007acc)',
  done:    'var(--vscode-testing-iconPassed, #2ea043)',
  failed:  'var(--vscode-errorForeground, #da3633)',
};

const STATUS_COLOR: Record<NodeStatus, string> = {
  idle:    'var(--vscode-descriptionForeground, #666)',
  pending: 'var(--vscode-descriptionForeground, #555)',
  active:  'var(--vscode-focusBorder, #007acc)',
  done:    'var(--vscode-testing-iconPassed, #2ea043)',
  failed:  'var(--vscode-errorForeground, #da3633)',
};

const STATUS_TEXT: Record<NodeStatus, string> = {
  idle:    'Ожидание',
  pending: 'В очереди',
  active:  '▶ Работает',
  done:    '✓ Готово',
  failed:  '✗ Ошибка',
};

const BADGE: Partial<Record<NodeStatus, string>> = { done: '✓', failed: '✕' };

const HANDLE = { background: 'var(--vscode-widget-border, #555)', width: 8, height: 8 };

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentNode({ data }: NodeProps) {
  const { labelRu, icon, status = 'pending', durationMs, errorMsg, retryLabel } =
    data as AgentNodeData;
  const s        = status as NodeStatus;
  const isActive = s === 'active';
  const isDimmed = s === 'pending' || s === 'idle';

  return (
    <>
      <Handle type="target" position={Position.Left}  style={HANDLE} />

      <div
        className={isActive ? 'nexus-node-active' : undefined}
        title={errorMsg}
        style={{
          background:   'var(--vscode-editorWidget-background, var(--vscode-editor-background, #252526))',
          border:       `2px solid ${BORDER[s]}`,
          borderRadius: 10,
          padding:      '12px 16px',
          minWidth:     130,
          textAlign:    'center',
          position:     'relative',
          opacity:      isDimmed ? 0.4 : 1,
          transition:   'opacity 0.3s, border-color 0.3s',
        }}
      >
        {/* Corner status badge */}
        {BADGE[s] && (
          <span style={{
            position: 'absolute', top: 6, right: 8,
            fontSize: 11, fontWeight: 700, color: BORDER[s],
          }}>
            {BADGE[s]}
          </span>
        )}

        {/* Emoji icon */}
        <div style={{ fontSize: 24, lineHeight: 1, marginBottom: 6 }}>{icon}</div>

        {/* Node label */}
        <div style={{
          fontSize: 12, fontWeight: 700, marginBottom: 4,
          color: 'var(--vscode-editor-foreground, #ccc)',
        }}>
          {labelRu}
        </div>

        {/* Status label */}
        <div style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: STATUS_COLOR[s] }}>
          {STATUS_TEXT[s]}
        </div>

        {/* Retry counter pill (shadowBuild only) */}
        {retryLabel && (
          <div style={{
            marginTop: 5, fontSize: 9, borderRadius: 8, padding: '1px 6px',
            background: 'var(--vscode-badge-background, #3c3c3c)',
            color:      'var(--vscode-badge-foreground, #ccc)',
          }}>
            {retryLabel}
          </div>
        )}

        {/* Elapsed time (done only) */}
        {s === 'done' && durationMs != null && (
          <div style={{ fontSize: 9, marginTop: 3, color: 'var(--vscode-descriptionForeground, #555)' }}>
            {(durationMs / 1000).toFixed(1)}s
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={HANDLE} />
    </>
  );
}
