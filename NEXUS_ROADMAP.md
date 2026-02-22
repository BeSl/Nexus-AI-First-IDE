# Nexus Agent IDE — Development Roadmap

> Last updated: 2026-02-22
> Current state: **Phase 9 complete** — 312/312 tests, tsc strict clean.

---

## Completed

### Phase 1 — Foundation
- `TFIDFVectorIndex` — semantic code search without embeddings API
- `AnthropicGateway` — Claude API wrapper with MCP tool protocol
- `InMemoryVFS` — staged file system (no disk writes until `confirm()`)

### Phase 2 — Context Layer
- `SkeletonProvider` — TypeScript Compiler API → public API skeleton (no bodies)
- `ContextEngine` — keyword-ranked file retrieval with token budget

### Phase 3 — AgentTS DSL
- `NexusLinter` — contract-first rules (max 150 lines, no `any`, no secrets)
- `ContractValidator` — validates `.types.ts` interfaces before agent proceed
- `OrchestratorBridge` — XState snapshot → WebviewPanel postMessage adapter

### Phase 4 — Agent Pipeline
- `ArchitectAgent` — `parseIntent()` + `designModules()` → interface artifacts
- `CoderAgent` — `implement()` with `buildFeedback` self-correction loop
- `ReviewerAgent` — SAST violations → throw on critical
- `TesterAgent` — Vitest spec generation per artifact
- XState `orchestratorMachine` — deterministic idle → architect → coder → reviewer → tester → done

### Phase 4.1 — Blueprints & Approvals
- `BlueprintRegistry` — stores ArchitectAgent module designs
- `PluginRegistry` — tool extension registry
- `NexusApprovalPanel` — VS Code WebviewPanel for human approve/reject gate

### Phase 4.2 — VS Code Extension + React Flow UI
- `src/extension.ts` — VS Code `activate()` with `nexus.run` + `nexus.showGraph` commands
- `NexusGraphPanel` — WebviewPanel serving bundled React Flow DAG
- `webview-src/NexusGraph.tsx` — live state visualization + agent progress sidebar
- `NexusLoop.ts` — XState actor lifecycle wiring, bridge to panel

### Phase 5 — LSP Layer
- `TypeScriptService` — in-process TS Compiler API: diagnostics (with VFS `sourceOverride`), type coverage, export finder
- `LspToolProvider` — MCP tool adapter: `ts_diagnostics`, `ts_type_coverage`, `ts_find_export`
- `AgentToolkit` extras pattern — pluggable tool providers, `handles()` routing

### Phase 6 — VFS → Real FS Committer
- `WorkspaceCommitter` — writes Artifact[] to workspace via injectable `IWorkspaceFs`
- Path-traversal guard, `createDirectory` before write, `nodeWorkspaceFs` Node.js adapter
- `NexusLoop.#onDone()` — QuickPick file selector before writing

### Phase 7 — Shadow Build
- `runShadowBuild` — in-process TS type-check via `TypeScriptService.getDiagnostics(sourceOverride)`
- `orchestratorMachine` — new `shadowBuild` state between coder and reviewer
- Retry loop: Coder receives `buildFeedback` on failure, up to `MAX_RETRIES=3`
- `OrchestratorContext` + `buildFeedback` + `retryCount` fields

### Phase 8 — Multi-Model Support
- `OllamaGateway` — local Ollama REST API via Node.js built-in fetch (no SDK)
  - Tools injected into system prompt as JSON schema
  - Configurable via `OLLAMA_BASE_URL` / `OLLAMA_MODEL`
- `GatewayFactory` — `createGateway({ provider })` — `'anthropic' | 'ollama'`
  - Reads `NEXUS_LLM_PROVIDER` env, opts override; exhaustive switch guard
- `NexusAgentFactory` — switched to `createGateway()`, model-agnostic agents

### Phase 9 — VFS Tree View Sidebar
- `NexusVfsProvider` — `TreeDataProvider<VfsFileItem>` for staged Artifact[] display
- `nexusVfs` activity bar panel with Approve All / Discard All buttons
- `NexusLoop` refreshes tree after each agent cycle
- 2 new commands: `nexus.vfs.approveAll`, `nexus.vfs.discardAll`

---

## Active Backlog

### Phase 10 — Packaging & Distribution (NEXT)
**Goal:** Publish to VS Code Marketplace as a one-click installable extension.

Tasks:
- `vsce package` → `nexus-agent-ide-0.1.0.vsix`
- Add `icon.png` (128×128), `publisher` field to `package.json`
- `.vscodeignore` — exclude `webview-src/`, `build-scripts/`, `*.spec.ts`, `node_modules`
- GitHub Actions workflow: `.github/workflows/release.yml` — `npm test && vsce publish` on tag push
- VS Code Marketplace listing copy + screenshots

Acceptance: `ext install nexus-agent-ide` works in any VS Code instance.

---

### Phase 7 — Shadow Build
**Goal:** Before approval, run `tsc --noEmit` against VFS content in a temp directory. Coder agent receives errors and self-corrects.

Tasks:
- `src/core/builder/ShadowBuildRunner.ts` — writes VFS to `~/.nexus/shadow/<taskId>/`, runs `tsc`, cleans up
- `ShadowBuildRunner.spec.ts` — mock `IBuildRunner`, assert cleanup on error
- Connect to XState machine: `coder → shadowBuild → (pass → reviewer | fail → coder[retry])`
- Expose `ts_shadow_build` as LspToolProvider extra tool (agent can trigger itself)
- `BuildFeedback.format()` → already implemented, wire to retry input

Acceptance: CoderAgent self-corrects up to 3 times before machine enters `failed`.

---

### Phase 8 — Multi-Model Support
**Goal:** `ILLMGateway` implementation for Google Gemini and local Ollama. Agents are model-agnostic.

Tasks:
- `src/core/llm/GeminiGateway.ts` — Google Generative AI SDK wrapper
- `src/core/llm/OllamaGateway.ts` — local Ollama REST API (no external deps)
- `src/core/llm/GatewayFactory.ts` — selects gateway from env: `NEXUS_LLM_PROVIDER=anthropic|gemini|ollama`
- `GatewayFactory.spec.ts` — test provider selection + fallback
- Update `NexusAgentFactory` to use `GatewayFactory`

Acceptance: set `NEXUS_LLM_PROVIDER=ollama OLLAMA_MODEL=codellama` and the full loop runs locally.

---

### Phase 9 — VFS Tree View Sidebar
**Goal:** VS Code sidebar panel showing staged VFS files with per-file approve/discard actions.

Tasks:
- `ui/NexusVfsProvider.ts` — implements `vscode.TreeDataProvider<VfsFileItem>`
- `ui/NexusVfsProvider.spec.ts` — mock VFS, assert tree items
- Register in `extension.ts`: `vscode.window.registerTreeDataProvider('nexusVfs', provider)`
- Per-file context menu: Approve, Discard, Open Diff
- Contribute `viewsContainers` + `views` to `package.json`

Acceptance: staged files appear in a "Nexus Files" panel in the Explorer sidebar.

---

### Phase 10 — Packaging & Distribution
**Goal:** Publish to VS Code Marketplace as a one-click installable extension.

Tasks:
- `vsce package` → `nexus-agent-ide-0.1.0.vsix`
- Add `icon.png` (128×128), `publisher` field to `package.json`
- `.vscodeignore` — exclude `webview-src/`, `build-scripts/`, `*.spec.ts`, `node_modules`
- GitHub Actions workflow: `.github/workflows/release.yml` — `npm test && vsce publish` on tag push
- VS Code Marketplace listing copy + screenshots

Acceptance: `ext install nexus-agent-ide` works in any VS Code instance.

---

## Longer-Term Ideas

| Idea | Value | Effort |
|------|-------|--------|
| Embeddings-based ContextEngine (OpenAI / local) | Better file ranking | Medium |
| Multi-file refactor mode (rename symbol across project) | Power feature | High |
| Git-aware VFS (show staged vs committed diff) | UX polish | Medium |
| Blueprint persistence (save/reload architecture designs) | Continuity | Low |
| Nexus CLI (`npx nexus run "intent"`) | CI integration | Medium |
| Agent telemetry panel (token usage, latency, cost) | Observability | Low |

---

## Architecture Constraints (Non-Negotiable)

1. **Max 150 lines per file** — decompose before hitting the limit
2. **Contract-first** — no implementation without `*.types.ts` interface
3. **Test-first** — no merge without passing `*.spec.ts`
4. **VFS isolation** — agents never write to real FS directly
5. **DI everywhere** — no `new ConcreteClass()` inside business logic
6. **`@security` JSDoc** — on every public method that touches I/O or LLM
