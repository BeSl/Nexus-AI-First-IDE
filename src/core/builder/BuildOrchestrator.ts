/**
 * BuildOrchestrator — Shadow Build Pipeline
 *
 * Pipeline:
 *   1. ShadowFS.prepare()  → изолирует копию проекта в ~/.nexus/shadow-build/<taskId>
 *   2. IBuildRunner.run()  → запускает сборку внутри shadow dir (инжектируется)
 *   3. ErrorAnalyzer       → парсит вывод, предлагает авто-фикс при ошибке
 *   4. ShadowFS.cleanup()  → всегда удаляет shadow dir (успех или провал)
 *
 * @security Никогда не пишет в реальный FS проекта.
 *           Применение фиксов — только через VFS.confirm() после апрувала юзера.
 */

import { join } from 'path';
import { homedir } from 'os';
import type {
  IBuildOrchestrator,
  IBuildRunner,
  IShadowFS,
  IErrorAnalyzer,
  ShadowBuildOptions,
  BuildResult,
} from './BuildOrchestrator.types.js';

const DEFAULT_TIMEOUT_MS = 120_000;
export const NEXUS_SHADOW_ROOT = join(homedir(), '.nexus', 'shadow-build');

export class BuildOrchestrator implements IBuildOrchestrator {
  readonly #shadowFS: IShadowFS;
  readonly #analyzer: IErrorAnalyzer;
  readonly #runner: IBuildRunner;

  constructor(shadowFS: IShadowFS, analyzer: IErrorAnalyzer, runner: IBuildRunner) {
    this.#shadowFS = shadowFS;
    this.#analyzer = analyzer;
    this.#runner = runner;
  }

  async runShadowBuild(opts: ShadowBuildOptions): Promise<BuildResult> {
    const { taskId, buildCommand, projectRoot, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
    const start = Date.now();

    let shadowDir = join(NEXUS_SHADOW_ROOT, taskId);
    let stdout = '';
    let stderr = '';
    let success = false;

    try {
      shadowDir = await this.#shadowFS.prepare(projectRoot, taskId);
      ({ stdout, stderr, success } = this.#runner.run(buildCommand, shadowDir, timeoutMs));
    } catch (err) {
      stderr = err instanceof Error ? err.message : String(err);
      success = false;
    }

    const errors = this.#analyzer.parse(stdout, stderr);
    const suggestedFix = success
      ? null
      : await this.#analyzer.suggest(errors, shadowDir);

    const result: BuildResult = {
      success,
      taskId,
      shadowDir,
      buildCommand,
      durationMs: Date.now() - start,
      stdout,
      stderr,
      errors,
      suggestedFix,
    };

    await this.#shadowFS.cleanup(shadowDir).catch(() => {
      console.warn(`[BuildOrchestrator] Cleanup failed for ${shadowDir}`);
    });

    return result;
  }
}
