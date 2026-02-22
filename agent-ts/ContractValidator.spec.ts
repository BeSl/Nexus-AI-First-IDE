/**
 * ContractValidator — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { ContractValidator } from './ContractValidator.js';

const cv = new ContractValidator();

const PROJECT_WITH_CONTRACTS = [
  'src/auth/auth.types.ts',
  'src/auth/AuthService.ts',
  'src/auth/AuthService.spec.ts',
  'src/builder/builder.types.ts',
  'src/builder/BuildOrchestrator.ts',
];

const PROJECT_MISSING_CONTRACT = [
  'src/payments/PaymentsService.ts',  // no .types.ts in src/payments/
];

// ── Single file validation ────────────────────────────────────────────────────

describe('ContractValidator.validate — valid cases', () => {
  it('passes when .types.ts exists in same directory', () => {
    const result = cv.validate('src/auth/AuthService.ts', PROJECT_WITH_CONTRACTS);
    expect(result.valid).toBe(true);
    expect(result.missingContract).toBeNull();
  });

  it('exempts .types.ts files themselves', () => {
    const result = cv.validate('src/auth/auth.types.ts', PROJECT_WITH_CONTRACTS);
    expect(result.valid).toBe(true);
  });

  it('exempts .spec.ts files', () => {
    const result = cv.validate('src/auth/AuthService.spec.ts', PROJECT_WITH_CONTRACTS);
    expect(result.valid).toBe(true);
  });

  it('exempts index.ts files', () => {
    const result = cv.validate('src/index.ts', PROJECT_WITH_CONTRACTS);
    expect(result.valid).toBe(true);
  });

  it('exempts prompts.ts files', () => {
    const result = cv.validate('agents/architect/prompts.ts', PROJECT_WITH_CONTRACTS);
    expect(result.valid).toBe(true);
  });
});

describe('ContractValidator.validate — violations', () => {
  it('fails when no .types.ts in directory', () => {
    const result = cv.validate('src/payments/PaymentsService.ts', PROJECT_MISSING_CONTRACT);
    expect(result.valid).toBe(false);
    expect(result.missingContract).toBeDefined();
  });

  it('suggests expected contract file path', () => {
    const result = cv.validate('src/payments/PaymentsService.ts', PROJECT_MISSING_CONTRACT);
    expect(result.missingContract).toContain('src/payments/');
    expect(result.missingContract).toContain('.types.ts');
  });

  it('message explains the issue', () => {
    const result = cv.validate('src/payments/PaymentsService.ts', PROJECT_MISSING_CONTRACT);
    expect(result.message).toContain('src/payments/');
  });
});

// ── Project-wide validation ───────────────────────────────────────────────────

describe('ContractValidator.validateProject', () => {
  it('passed is true when all files have contracts', () => {
    const result = cv.validateProject(PROJECT_WITH_CONTRACTS);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('detects missing contract in project', () => {
    const files = [
      'src/auth/auth.types.ts',
      'src/auth/AuthService.ts',
      'src/payments/PaymentsService.ts',  // missing types
    ];
    const result = cv.validateProject(files);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.file).toBe('src/payments/PaymentsService.ts');
  });

  it('ignores spec and types files in violation count', () => {
    const files = [
      'src/foo/foo.types.ts',
      'src/foo/Foo.ts',
      'src/foo/Foo.spec.ts',
      'src/foo/index.ts',
    ];
    const result = cv.validateProject(files);
    expect(result.passed).toBe(true);
  });
});
