/**
 * ContractValidator — Contract-First Engine
 *
 * Enforces: no implementation without a prior .types.ts contract.
 * For every implementation file, checks:
 *   1. A .types.ts file exists in the same directory
 *   2. Every exported class has an `implements` clause (delegated to NEXUS-008)
 *
 * Usage:
 *   const cv = new ContractValidator();
 *   const result = cv.validate('src/auth/AuthService.ts', allProjectFiles);
 *
 * @security Read-only — only examines file paths, does not access FS directly.
 */

/** Result for a single file validation */
export interface ContractValidationResult {
  readonly file: string;
  readonly valid: boolean;
  /** The missing .types.ts file path (if any) */
  readonly missingContract: string | null;
  readonly message: string;
}

/** Project-wide validation result */
export interface ProjectContractResult {
  readonly violations: readonly ContractValidationResult[];
  readonly passed: boolean;
}

export class ContractValidator {
  /**
   * Validate a single implementation file against the project file list.
   * @param filePath Path of the file to validate (e.g. "src/auth/AuthService.ts")
   * @param projectFiles All known file paths in the project
   */
  validate(filePath: string, projectFiles: readonly string[]): ContractValidationResult {
    if (this.#isExempt(filePath)) {
      return { file: filePath, valid: true, missingContract: null, message: 'Exempt file.' };
    }

    const dir = dirOf(filePath);
    const hasContract = projectFiles.some(
      (f) => dirOf(f) === dir && f.endsWith('.types.ts'),
    );

    if (!hasContract) {
      const expected = `${dir}/${basenameWithout(filePath)}.types.ts`;
      return {
        file: filePath,
        valid: false,
        missingContract: expected,
        message: `No .types.ts contract found in '${dir}/'. Create '${expected}' first.`,
      };
    }

    return { file: filePath, valid: true, missingContract: null, message: 'Contract present.' };
  }

  /**
   * Validate all implementation files in the project.
   * Returns only violations.
   */
  validateProject(projectFiles: readonly string[]): ProjectContractResult {
    const violations = projectFiles
      .filter((f) => !this.#isExempt(f))
      .map((f) => this.validate(f, projectFiles))
      .filter((r) => !r.valid);

    return { violations, passed: violations.length === 0 };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  #isExempt(filePath: string): boolean {
    return (
      filePath.includes('.types.') ||
      filePath.includes('.spec.') ||
      filePath.includes('prompts.ts') ||
      filePath.includes('index.ts') ||
      !filePath.endsWith('.ts')
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dirOf(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  return slash === -1 ? '.' : filePath.slice(0, slash);
}

function basenameWithout(filePath: string): string {
  const base = filePath.slice(filePath.lastIndexOf('/') + 1);
  return base.replace(/\.ts$/, '');
}
