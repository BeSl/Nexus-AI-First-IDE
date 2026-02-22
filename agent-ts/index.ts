/**
 * AgentTS — Public API
 *
 * Static analysis and Contract-First validation for the Nexus IDE.
 * Zero LLM calls — pure TypeScript, runs in CI.
 */

export { NexusLinter } from './NexusLinter.js';
export type { LintSummary } from './NexusLinter.js';
export { ContractValidator } from './ContractValidator.js';
export type { ContractValidationResult, ProjectContractResult } from './ContractValidator.js';
export { ALL_RULES, NEXUS_001, NEXUS_002, NEXUS_003, NEXUS_004,
         NEXUS_005, NEXUS_006, NEXUS_007, NEXUS_008 } from './rules.js';
export type { LintViolation, LintResult, NexusRule, ViolationSeverity } from './rules.types.js';
