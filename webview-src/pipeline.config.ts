/**
 * pipeline.config — Static pipeline definition + ReactFlow node/edge builders.
 * Each entry maps 1:1 to an XState state in orchestrator.machine.ts.
 *
 * @security Pure data transforms — no side-effects, no eval.
 */

import { type Node, type Edge, MarkerType } from '@xyflow/react';
import type { NexusState } from './protocol.js';
import type { NodeStatus } from './AgentNode.js';

export const PIPELINE = [
  { id: 'idle',             labelRu: 'Старт',        icon: '🚀', x: 0    },
  { id: 'architect',        labelRu: 'Архитектор',   icon: '🏗',  x: 200  },
  { id: 'awaitingApproval', labelRu: 'Согласование', icon: '✋',  x: 400  },
  { id: 'coder',            labelRu: 'Кодер',        icon: '💻',  x: 600  },
  { id: 'shadowBuild',      labelRu: 'Сборка',       icon: '🔨',  x: 800  },
  { id: 'reviewer',         labelRu: 'Ревьюер',      icon: '🔍',  x: 1000 },
  { id: 'tester',           labelRu: 'Тестер',       icon: '🧪',  x: 1200 },
  { id: 'done',             labelRu: 'Готово',       icon: '🎉',  x: 1400 },
] as const;

type PipelineId = typeof PIPELINE[number]['id'];

const ORDER = PIPELINE.map((n) => n.id) as string[];

export const STATE_LABELS: Record<string, string> = {
  idle:             'Ожидание',
  architect:        'Архитектор',
  awaitingApproval: 'Согласование',
  coder:            'Кодер',
  shadowBuild:      'Сборка TypeScript',
  reviewer:         'Ревьюер',
  tester:           'Тестер',
  done:             'Готово ✓',
  failed:           'Ошибка ✗',
  cancelled:        'Отменено',
};

// ── Status resolution ─────────────────────────────────────────────────────────

function resolveStatus(id: string, cur: string, state: NexusState | null): NodeStatus {
  if (id === cur) {
    if (cur === 'done')                        return 'done';
    if (cur === 'failed' || cur === 'cancelled') return 'failed';
    return 'active';
  }
  const prog = state?.progress?.find((p) => p.role === id);
  if (prog?.status === 'done')   return 'done';
  if (prog?.status === 'failed') return 'failed';
  if (prog?.status === 'active') return 'active';
  const ci = ORDER.indexOf(cur);
  const ni = ORDER.indexOf(id);
  return ci > 0 && ni >= 0 && ni < ci ? 'done' : 'pending';
}

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildNodes(state: NexusState | null): Node[] {
  const cur  = state?.currentState ?? 'idle';
  const durs = new Map(state?.progress?.map((p) => [p.role, p.durationMs]));

  return PIPELINE.map((n) => {
    const status     = resolveStatus(n.id, cur, state);
    const isShadow   = n.id === 'shadowBuild';
    const retryLabel = isShadow && (state?.retryCount ?? 0) > 0
      ? `Попытка ${state!.retryCount}/3`
      : undefined;

    return {
      id: n.id, type: 'agent',
      position: { x: n.x, y: 0 },
      data: {
        labelRu:    n.labelRu,
        icon:       n.icon,
        status,
        durationMs: durs.get(n.id as PipelineId & string),
        errorMsg:   status === 'failed' ? (state?.error ?? undefined) : undefined,
        retryLabel,
      },
    };
  });
}

export function buildEdges(state: NexusState | null): Edge[] {
  const cur = state?.currentState ?? 'idle';
  const MK  = { markerEnd: { type: MarkerType.ArrowClosed } };

  return PIPELINE.slice(0, -1).map((n, i) => {
    const tgt    = PIPELINE[i + 1]!;
    const active = cur === n.id;
    return {
      id: `${n.id}->${tgt.id}`,
      source: n.id, target: tgt.id,
      ...MK,
      animated: active,
      style: {
        stroke:      active ? 'var(--vscode-focusBorder, #007acc)' : 'var(--vscode-widget-border, #3c3c3c)',
        strokeWidth: active ? 2.5 : 1.5,
        transition:  'stroke 0.4s, stroke-width 0.3s',
      },
    };
  });
}
