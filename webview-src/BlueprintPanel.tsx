/**
 * BlueprintPanel — Slide-in detail panel for a selected pipeline node.
 * Shows: role, status, function description, duration, artifact count, error log.
 * Binds to XState context: currentState (agent), status (pipeline), error (lastError).
 * @security No eval — data from postMessage structural objects only.
 */

import React from 'react';
import type { NexusState } from './protocol.js';
import { BP } from './blueprint.styles.js';

export interface PanelData { role: string; labelRu: string; icon: string; status: string }
interface Props { panel: PanelData | null; nexusState: NexusState | null; onClose: () => void }

const ROLE_DESC: Record<string, string> = {
  idle:             'Ожидание входящего задания от пользователя',
  architect:        'Анализирует намерение, проектирует контракты, создаёт список артефактов',
  awaitingApproval: 'Ожидает подтверждения плана — Human-in-the-loop checkpoint',
  coder:            'Реализует интерфейсы и логику согласно утверждённым артефактам',
  shadowBuild:      'Запускает tsc в теневой копии VFS для валидации типов',
  reviewer:         'Статический анализ: SAST, паттерны AgentTS, отсутствие секретов',
  tester:           'Запускает Vitest suite — зелёный CI подтверждает готовность',
  done:             'Задание выполнено, артефакты записаны в VFS',
};

function Row({ label, value, clr }: { label: string; value: string; clr?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontSize: 9, letterSpacing: 1.5, color: BP.textDim,
        textTransform: 'uppercase' as const, marginBottom: 2,
        fontFamily: '"Courier New", monospace',
      }}>{label}</div>
      <div style={{ fontSize: 11, color: clr ?? BP.text, fontFamily: '"Courier New", monospace' }}>{value}</div>
    </div>
  );
}

export function BlueprintPanel({ panel, nexusState, onClose }: Props) {
  if (!panel) return null;

  const prog  = nexusState?.progress?.find((p) => p.role === (panel.role as never));
  const err   = nexusState?.error;
  const retry = nexusState?.retryCount;
  const sClr  = { active: BP.nodeActive, done: BP.nodeDone, failed: BP.nodeFailed }[panel.status]
    ?? BP.nodeIdle;

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, width: 275, height: '100%', zIndex: 10,
      background: `linear-gradient(180deg, #060f1c 0%, ${BP.nodeBg} 100%)`,
      borderLeft: `1px solid ${sClr}`, boxShadow: `-4px 0 24px ${sClr}33`,
      display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", monospace',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${sClr}44`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>{panel.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: BP.textDim, letterSpacing: 1.5 }}>AGENT DETAIL</div>
          <div style={{
            fontSize: 12, fontWeight: 700, color: sClr,
            textTransform: 'uppercase' as const, letterSpacing: 1,
          }}>{panel.labelRu}</div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: `1px solid ${BP.nodeIdle}`,
          color: BP.textDim, borderRadius: 2, width: 22, height: 22,
          cursor: 'pointer', fontSize: 11, lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: 14, overflowY: 'auto' as const }}>
        <Row label="Role"     value={panel.role.toUpperCase()} />
        <Row label="Status"   value={panel.status.toUpperCase()} clr={sClr} />
        <Row label="Function" value={ROLE_DESC[panel.role] ?? '—'} />
        {prog?.durationMs    != null && <Row label="Duration"  value={`${(prog.durationMs / 1000).toFixed(1)}s`} />}
        {prog?.artifactCount != null && <Row label="Artifacts" value={`${prog.artifactCount} файлов`} />}
        {retry != null && <Row label="Retry" value={`Attempt ${retry}/3`} clr={BP.nodeActive} />}

        {err && panel.status === 'failed' && (
          <div style={{
            marginTop: 8, padding: '8px 10px',
            background: `${BP.nodeFailed}0f`, border: `1px solid ${BP.nodeFailed}44`, borderRadius: 3,
          }}>
            <div style={{ fontSize: 9, letterSpacing: 1.5, color: BP.nodeFailed, marginBottom: 5 }}>
              ERROR LOG
            </div>
            <pre style={{
              fontSize: 9, color: `${BP.nodeFailed}cc`, margin: 0,
              whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const,
            }}>{err}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
