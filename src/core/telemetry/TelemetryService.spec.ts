/**
 * TelemetryService — Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TelemetryService } from './TelemetryService.js';
import type { AgentCycleRecord } from './TelemetryService.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function rec(overrides: Partial<AgentCycleRecord> = {}): AgentCycleRecord {
  return {
    agentRole:    'coder',
    model:        'claude-sonnet-4-5',
    inputTokens:  100,
    outputTokens: 50,
    durationMs:   1000,
    success:      true,
    timestamp:    Date.now(),
    ...overrides,
  };
}

let svc: TelemetryService;
beforeEach(() => { svc = new TelemetryService(); });

// ── initial state ─────────────────────────────────────────────────────────────

describe('TelemetryService — initial state', () => {
  it('starts with no records', () => {
    expect(svc.records).toHaveLength(0);
  });

  it('getSummary on empty returns zeros', () => {
    const s = svc.getSummary();
    expect(s.totalTokens).toBe(0);
    expect(s.cycles).toBe(0);
    expect(s.successRate).toBe(0);
    expect(s.estimatedCostUsd).toBe(0);
    expect(s.byRole).toEqual({});
  });
});

// ── record ────────────────────────────────────────────────────────────────────

describe('TelemetryService.record', () => {
  it('stores a single record', () => {
    svc.record(rec());
    expect(svc.records).toHaveLength(1);
  });

  it('accumulates multiple records', () => {
    svc.record(rec({ agentRole: 'architect' }));
    svc.record(rec({ agentRole: 'coder' }));
    svc.record(rec({ agentRole: 'reviewer' }));
    expect(svc.records).toHaveLength(3);
  });

  it('records snapshot is a copy (immutable guard)', () => {
    svc.record(rec());
    const snap = svc.records;
    svc.record(rec());
    expect(snap).toHaveLength(1);
    expect(svc.records).toHaveLength(2);
  });
});

// ── getSummary ────────────────────────────────────────────────────────────────

describe('TelemetryService.getSummary', () => {
  it('sums token counts correctly', () => {
    svc.record(rec({ inputTokens: 100, outputTokens: 50 }));
    svc.record(rec({ inputTokens: 200, outputTokens: 80 }));
    const s = svc.getSummary();
    expect(s.totalInputTokens).toBe(300);
    expect(s.totalOutputTokens).toBe(130);
    expect(s.totalTokens).toBe(430);
  });

  it('computes successRate correctly', () => {
    svc.record(rec({ success: true  }));
    svc.record(rec({ success: false }));
    svc.record(rec({ success: true  }));
    expect(svc.getSummary().successRate).toBeCloseTo(2 / 3);
  });

  it('groups cycles and tokens by role', () => {
    svc.record(rec({ agentRole: 'architect', inputTokens: 50, outputTokens: 20 }));
    svc.record(rec({ agentRole: 'coder',     inputTokens: 100, outputTokens: 60 }));
    svc.record(rec({ agentRole: 'coder',     inputTokens: 80,  outputTokens: 40 }));
    const s = svc.getSummary();
    expect(s.byRole['architect']?.cycles).toBe(1);
    expect(s.byRole['coder']?.cycles).toBe(2);
    expect(s.byRole['coder']?.tokens).toBe(280);
  });

  it('estimates cost for claude-sonnet model ($3 in / $15 out per 1M)', () => {
    svc.record(rec({
      model:        'claude-sonnet-4-5',
      inputTokens:  1_000_000,
      outputTokens: 1_000_000,
    }));
    expect(svc.getSummary().estimatedCostUsd).toBeCloseTo(18.0);
  });

  it('cost is zero for ollama (free provider)', () => {
    svc.record(rec({ model: 'ollama/codellama:7b', inputTokens: 1_000_000, outputTokens: 500_000 }));
    expect(svc.getSummary().estimatedCostUsd).toBe(0);
  });

  it('cost is zero for unknown model', () => {
    svc.record(rec({ model: 'unknown-model-v99', inputTokens: 100_000, outputTokens: 50_000 }));
    expect(svc.getSummary().estimatedCostUsd).toBe(0);
  });

  it('estimates cost for gemini-2.0-flash ($0.075/$0.30 per 1M)', () => {
    svc.record(rec({
      model:        'gemini-2.0-flash',
      inputTokens:  1_000_000,
      outputTokens: 1_000_000,
    }));
    expect(svc.getSummary().estimatedCostUsd).toBeCloseTo(0.375);
  });
});

// ── recordFromUsage ───────────────────────────────────────────────────────────

describe('TelemetryService.recordFromUsage', () => {
  it('stores record from usage data', () => {
    svc.recordFromUsage(
      'reviewer', 'claude-sonnet-4-5',
      { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      500, true,
    );
    expect(svc.records).toHaveLength(1);
    expect(svc.records[0]?.agentRole).toBe('reviewer');
    expect(svc.records[0]?.inputTokens).toBe(10);
  });

  it('stores errorMessage when provided', () => {
    svc.recordFromUsage(
      'tester', 'claude-haiku-4-5',
      { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
      100, false, 'timeout',
    );
    expect(svc.records[0]?.errorMessage).toBe('timeout');
    expect(svc.records[0]?.success).toBe(false);
  });

  it('omits errorMessage when not provided', () => {
    svc.recordFromUsage('architect', 'claude-haiku-4-5',
      { inputTokens: 5, outputTokens: 2, totalTokens: 7 }, 200, true);
    expect('errorMessage' in (svc.records[0] ?? {})).toBe(false);
  });
});

// ── reset ─────────────────────────────────────────────────────────────────────

describe('TelemetryService.reset', () => {
  it('clears all records', () => {
    svc.record(rec());
    svc.record(rec());
    svc.reset();
    expect(svc.records).toHaveLength(0);
  });

  it('getSummary returns zeros after reset', () => {
    svc.record(rec({ inputTokens: 1000, outputTokens: 500 }));
    svc.reset();
    expect(svc.getSummary().totalTokens).toBe(0);
  });
});
