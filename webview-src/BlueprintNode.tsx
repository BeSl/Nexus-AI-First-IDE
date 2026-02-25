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
  width: 16, height: 16, 
  background: `linear-gradient(135deg, ${BP.nodeBg} 0%, #0a1628 100%)`,
  border: `2px solid ${c}`,
  borderRadius: '4px',
  boxShadow: `0 0 8px ${c}44`,
});

export function BlueprintNode({ data }: NodeProps) {
  const { labelRu, role, icon, status = 'pending', durationMs, errorMsg, retryLabel, onSelect } =
    data as BlueprintNodeData;
  const border = BORDER[status] ?? BP.nodeIdle;

  return (
    <>
      {/* Input handle - left side */}
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{
          ...pin(border),
          left: -8,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />

      {/* Main node card */}
      <div
        className={ANIM[status]}
        title={errorMsg ?? labelRu}
        onClick={() => onSelect?.(role, status)}
        style={{
          width: 220,
          cursor: 'pointer',
          background: `linear-gradient(180deg, ${BP.nodeBg} 0%, #070d19 100%)`,
          border: `2px solid ${border}`,
          borderRadius: 12,
          boxShadow: GLOW[status] ?? `0 4px 20px rgba(0,0,0,0.4)`,
          opacity: status === 'pending' ? 0.4 : 1,
          transition: 'all 0.3s ease',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        {/* Header bar - n8n style */}
        <div style={{
          background: `${border}22`, borderBottom: `1px solid ${border}33`,
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `${border}18`, border: `1px solid ${border}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            {icon}
          </div>
          <span style={{
            fontSize: 13, fontWeight: 600, letterSpacing: 0.5,
            color: BP.text, 
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>{labelRu}</span>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
            color: STATUS_CLR[status] ?? BP.textDim,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textTransform: 'uppercase' as const,
          }}>
            {STATUS_LABEL[status] ?? status.toUpperCase()}
          </div>

          {retryLabel && (
            <div style={{
              marginTop: 8, fontSize: 10, padding: '4px 8px', display: 'inline-block',
              background: `${BP.nodeActive}22`, border: `1px solid ${BP.nodeActive}55`,
              borderRadius: 4, color: BP.nodeActive, fontWeight: 600,
            }}>{retryLabel}</div>
          )}

          {status === 'done' && durationMs != null && (
            <div style={{ fontSize: 11, color: BP.textDim, marginTop: 8, fontWeight: 500 }}>
              ⏱ {(durationMs / 1000).toFixed(1)}s
            </div>
          )}
        </div>
      </div>

      {/* Output handle - right side */}
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{
          ...pin(border),
          right: -8,
          top: '50%',
          transform: 'translateY(-50%)',
        }} 
      />
    </>
  );
}
