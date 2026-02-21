/**
 * BuildRunner — Реальная реализация IBuildRunner через execSync.
 * Изолирована в отдельный файл, чтобы тесты могли инжектировать мок.
 */

import { execSync } from 'child_process';
import type { IBuildRunner } from './BuildOrchestrator.types.js';

export class BuildRunner implements IBuildRunner {
  run(
    command: string,
    cwd: string,
    timeoutMs: number
  ): { stdout: string; stderr: string; success: boolean } {
    try {
      const out = execSync(command, {
        cwd,
        timeout: timeoutMs,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { stdout: out, stderr: '', success: true };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      return {
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? e.message ?? 'Unknown build error',
        success: false,
      };
    }
  }
}
