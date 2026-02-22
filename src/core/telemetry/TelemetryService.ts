/**
 * TelemetryService — In-process token usage and cost tracker
 *
 * Records agent cycle metrics (tokens, duration, success) in memory.
 * All data stays local — no external telemetry endpoints ever called.
 *
 * Cost estimates use public 2025 API pricing per 1M tokens.
 * Ollama and other local providers are always $0.
 *
 * @security No prompts or code content stored. Counters and durations only.
 */

import type { AgentRole } from '../../../core/orchestrator.types.js';
import type { TokenUsage } from '../llm/LLMGateway.types.js';

// ── Cost table (USD / 1M tokens, public 2025 rates) ──────────────────────────

const COST_TABLE: Readonly<Record<string, { input: number; output: number }>> = {
  'claude-sonnet':    { input: 3.0,   output: 15.0  },
  'claude-haiku':     { input: 0.25,  output: 1.25  },
  'claude-opus':      { input: 15.0,  output: 75.0  },
  'gemini-2.0-flash': { input: 0.075, output: 0.30  },
  'gemini-1.5-pro':   { input: 1.25,  output: 5.0   },
  'gemini-1.5-flash': { input: 0.075, output: 0.30  },
};

const FREE_PREFIXES = ['ollama'];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentCycleRecord {
  readonly agentRole:    AgentRole;
  readonly model:        string;
  readonly inputTokens:  number;
  readonly outputTokens: number;
  readonly durationMs:   number;
  readonly success:      boolean;
  readonly errorMessage?: string;
  readonly timestamp:    number;
}

export interface RoleStat {
  readonly cycles: number;
  readonly tokens: number;
}

export interface TelemetrySummary {
  readonly totalInputTokens:  number;
  readonly totalOutputTokens: number;
  readonly totalTokens:       number;
  readonly estimatedCostUsd:  number;
  readonly cycles:            number;
  readonly successRate:       number;
  readonly byRole: Readonly<Partial<Record<AgentRole, RoleStat>>>;
}

// ── TelemetryService ──────────────────────────────────────────────────────────

export class TelemetryService {
  readonly #records: AgentCycleRecord[] = [];

  /**
   * Record a completed agent cycle.
   * @security Never include prompt text or generated code in records.
   */
  record(entry: AgentCycleRecord): void {
    this.#records.push(entry);
  }

  /** Convenience: record from an LLMResponse usage object. */
  recordFromUsage(
    agentRole:     AgentRole,
    model:         string,
    usage:         TokenUsage,
    durationMs:    number,
    success:       boolean,
    errorMessage?: string,
  ): void {
    this.record({
      agentRole,
      model,
      inputTokens:  usage.inputTokens,
      outputTokens: usage.outputTokens,
      durationMs,
      success,
      ...(errorMessage ? { errorMessage } : {}),
      timestamp: Date.now(),
    });
  }

  /** Aggregate summary across all recorded cycles. */
  getSummary(): TelemetrySummary {
    let totalInput  = 0;
    let totalOutput = 0;
    let totalCost   = 0;
    let successes   = 0;
    const byRole: Partial<Record<AgentRole, { cycles: number; tokens: number }>> = {};

    for (const r of this.#records) {
      totalInput  += r.inputTokens;
      totalOutput += r.outputTokens;
      totalCost   += estimateCost(r.model, r.inputTokens, r.outputTokens);
      if (r.success) successes++;

      const prev = byRole[r.agentRole] ?? { cycles: 0, tokens: 0 };
      byRole[r.agentRole] = {
        cycles: prev.cycles + 1,
        tokens: prev.tokens + r.inputTokens + r.outputTokens,
      };
    }

    const cycles = this.#records.length;
    return {
      totalInputTokens:  totalInput,
      totalOutputTokens: totalOutput,
      totalTokens:       totalInput + totalOutput,
      estimatedCostUsd:  totalCost,
      cycles,
      successRate: cycles === 0 ? 0 : successes / cycles,
      byRole,
    };
  }

  /** All raw records (snapshot copy). */
  get records(): readonly AgentCycleRecord[] { return [...this.#records]; }

  /** Reset all recorded data. */
  reset(): void { this.#records.length = 0; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  if (FREE_PREFIXES.some((p) => model.startsWith(p))) return 0;
  const key = Object.keys(COST_TABLE).find((k) => model.includes(k));
  if (!key) return 0;
  const rates = COST_TABLE[key]!;
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}
