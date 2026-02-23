/**
 * BlueprintNode — Unreal Blueprint-style custom React Flow node.
 *   active  → cyan pulsing glow (.bp-active keyframe)
 *   failed  → red glow + shake animation (.bp-failed keyframe)
 *   done    → green flash (.bp-done keyframe)
 *   pending → dimmed, no glow
 * Click triggers onSelect(role, status) to open the detail panel.
 * Tooltip on hover via native HTML title attribute.
 * @security No eval — data via postMessage structural objects only.
 */

import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { BP, BORDER, GLOW } from './blueprint.styles.js';

export interface BlueprintNodeData extends Record<string, unknown> {
  labelRu:    string;
  role:       string;
  icon:       string;
  status:     string;
  durationMs?: number;
  errorMsg?:  string;
  retryLabel?: string;
  onSelect?:  (role: string, status: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'STANDBY', pending: 'QUEUED', active: '▶ RUNNING', done: '✓ COMPLETE', failed: '✗ FAILED',
};

const STATUS_CLR: Record<string, string> = {
  idle: BP.textDim, pending: BP.textDim,
  active: BP.nodeActive, done: BP.nodeDone, failed: BP.nodeFailed,
};

const ANIM: Record<string, string> = { active: 'bp-active', failed: 'bp-failed', done: 'bp-done' };

const pin = (c: string) => ({
  width: 10, height: 10, background: c, border: `2px solid ${BP.bg}`, borderRadius: 2,
});

export function BlueprintNode({ data }: NodeProps) {
  const { labelRu, role, icon, status = 'pending', durationMs, errorMsg, retryLabel, onSelect } =
    data as BlueprintNodeData;
  const border = BORDER[status] ?? BP.nodeIdle;

  return (
    <>
      <Handle type="target" position={Position.Left} style={pin(border)} />

      <div
        className={ANIM[status]}
        title={errorMsg ?? labelRu}
        onClick={() => onSelect?.(role, status)}
        style={{
          minWidth: 160, cursor: 'pointer',
          background: `linear-gradient(155deg, ${BP.nodeBg}, #080f1e)`,
          border: `1px solid ${border}`,
          borderRadius: 3,
          boxShadow: GLOW[status] ?? 'none',
          opacity: status === 'pending' ? 0.45 : 1,
          transition: 'opacity 0.3s, box-shadow 0.3s',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        {/* Header bar */}
        <div style={{
          background: `${border}18`, borderBottom: `1px solid ${border}44`,
          padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <span style={{ fontSize: 15 }}>{icon}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
            color: BP.text, textTransform: 'uppercase' as const,
            fontFamily: '"Courier New", monospace',
          }}>{labelRu}</span>
        </div>

        {/* Body */}
        <div style={{ padding: '7px 10px' }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
            color: STATUS_CLR[status] ?? BP.textDim,
            fontFamily: '"Courier New", monospace',
          }}>
            {STATUS_LABEL[status] ?? status.toUpperCase()}
          </div>

          {retryLabel && (
            <div style={{
              marginTop: 4, fontSize: 8, padding: '1px 5px', display: 'inline-block',
              background: `${BP.nodeActive}18`, border: `1px solid ${BP.nodeActive}44`,
              borderRadius: 2, color: BP.nodeActive,
            }}>{retryLabel}</div>
          )}

          {status === 'done' && durationMs != null && (
            <div style={{ fontSize: 8, color: BP.textDim, marginTop: 3 }}>
              {(durationMs / 1000).toFixed(1)}s
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={pin(border)} />
    </>
  );
}
