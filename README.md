# Nexus Agent IDE

> AI-First development environment built on VS Code Extension API.
> Human as Architect — agents as implementers.

---

## What Is This

Nexus is a VS Code extension that orchestrates a multi-agent loop (Architect → Coder → Reviewer → Tester) over your TypeScript codebase. Every agent call goes through a deterministic XState machine — no implicit side effects, no random retries. Code is written to an in-memory VFS and only committed to disk after human approval.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  VS Code Extension  (src/extension.ts)                       │
│    nexus.run ──► NexusLoop ──► XState orchestratorMachine   │
│    nexus.showGraph ──► NexusGraphPanel (React Flow DAG)      │
└──────────────────────────┬──────────────────────────────────┘
                           │ actors
         ┌─────────────────┼────────────────────┐
         ▼                 ▼                    ▼
   runArchitect       runCoder         runReviewer / runTester
         │                │
         ▼                ▼
   ArchitectAgent    CoderAgent  ──► InMemoryVFS ──► VFSCommitter
         │                │
         └────────────────┴── AnthropicGateway (Claude)
                                    │
                              AgentToolkit
                         ┌──────────┴──────────┐
                    core tools            LSP extras
                 context_query           ts_diagnostics
                 vector_search           ts_type_coverage
                 read_skeleton           ts_find_export
```

### Key Layers

| Layer | Path | Role |
|-------|------|------|
| XState machine | [core/orchestrator.machine.ts](core/orchestrator.machine.ts) | Deterministic state transitions |
| Agent personas | [agents/](agents/) | Architect, Coder, Reviewer, Tester |
| LLM Gateway | [src/core/llm/](src/core/llm/) | Anthropic SDK + MCP tool protocol |
| Context Engine | [src/core/context/](src/core/context/) | TF-IDF index + skeleton provider |
| LSP Layer | [src/core/lsp/](src/core/lsp/) | TypeScript Compiler API diagnostics |
| VFS | [core/vfs.types.ts](core/vfs.types.ts) | In-memory file system (staged writes) |
| AgentTS Linter | [agent-ts/](agent-ts/) | Contract-first rule enforcement DSL |
| React Flow UI | [webview-src/](webview-src/) | Live DAG of XState states |
| VS Code Entry | [src/extension.ts](src/extension.ts) | Commands + WebviewPanel lifecycle |

---

## Completed Phases

| # | Phase | What Was Built | Tests |
|---|-------|---------------|-------|
| 1 | Foundation | VectorIndex (TF-IDF), AnthropicGateway, InMemoryVFS | ✓ |
| 2 | Context | SkeletonProvider (TS Compiler API), ContextEngine | ✓ |
| 3 | AgentTS | NexusLinter, ContractValidator, OrchestratorBridge | ✓ |
| 4 | Agents | ArchitectAgent, CoderAgent, ReviewerAgent, TesterAgent, XState orchestrator | ✓ |
| 4.1 | Blueprints | BlueprintRegistry, PluginRegistry, NexusApprovalPanel | ✓ |
| 4.2 | UI + Extension | React Flow Webview, VS Code Extension entry point (`nexus.run`, `nexus.showGraph`) | ✓ |
| 5 | LSP | TypeScriptService (in-process), LspToolProvider, AgentToolkit extras pattern | ✓ |

**263 / 263 tests passing. `tsc --strict` clean.**

---

## Quick Start

### Prerequisites

- Node.js ≥ 18, npm ≥ 9
- VS Code ≥ 1.96
- Anthropic API key

### Install & Build

```bash
git clone https://github.com/BeSl/Nexus-AI-First-IDE.git
cd Nexus-AI-First-IDE
npm install

# Compile extension host (TypeScript → dist/)
npm run compile

# Build React Flow webview bundle (→ dist/webview/)
npm run build:webview
```

### Environment

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### Test

```bash
npm test
# 263 tests across 22 test files
```

### Run in VS Code

Press **F5** (Extension Development Host) or install the `.vsix`.

Commands available via `Ctrl+Shift+P`:
- **`Nexus: Show Architecture Graph`** — opens React Flow DAG panel
- **`Nexus: Run Agent Loop`** — prompts for intent, starts the agent pipeline

---

## The Nexus Loop

```
User Intent (natural language)
  ↓
ArchitectAgent.parseIntent() + designModules()
  ↓ artifacts: [*.types.ts interfaces]
[User approves blueprint]  ← awaitingApproval gate
  ↓
CoderAgent.implement()
  ↓ code written to InMemoryVFS
ReviewerAgent.review()     ← SAST: no `any`, no secrets
  ↓
TesterAgent.generateTests()
  ↓
[User confirms VFS diff]   ← VFSCommitter → real disk
```

**Rule:** Agents never read files directly — only via `ContextEngine.query()` and LSP tools.

---

## Project Structure

```
nexus-agent-ide/
├── core/                    # Shared contracts (XState machine, orchestrator types, VFS)
├── src/
│   ├── core/
│   │   ├── context/         # ContextEngine, VectorIndex, SkeletonProvider
│   │   ├── llm/             # AnthropicGateway, AgentToolkit, LspToolProvider
│   │   ├── lsp/             # TypeScriptService, LspToolProvider, lsp.types
│   │   ├── builder/         # BuildOrchestrator, ShadowFS, ErrorAnalyzer
│   │   ├── security/        # SastRunner + NexusLinter rules
│   │   └── NexusAgentFactory.ts  # DI root
│   ├── extension.ts         # VS Code activate / deactivate
│   └── NexusLoop.ts         # XState actor wiring → NexusGraphPanel
├── agents/
│   ├── architect/           # ArchitectAgent
│   ├── coder/               # CoderAgent
│   ├── reviewer/            # ReviewerAgent
│   └── tester/              # TesterAgent
├── agent-ts/                # AgentTS DSL / Contract linter
├── ui/                      # NexusGraphPanel, NexusApprovalPanel
├── webview-src/             # React Flow app (browser bundle)
├── build-scripts/           # esbuild + tsc automation
└── dist/                    # Compiled output (git-ignored)
    ├── src/extension.js     # Extension host entry
    └── webview/index.js     # React webview bundle
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.4 (strict + exactOptionalPropertyTypes) |
| State machines | XState 5 |
| LLM | Anthropic Claude (`claude-sonnet-4-6`) via MCP tool protocol |
| AST / LSP | TypeScript Compiler API (in-process, no tsserver) |
| UI | React 19 + @xyflow/react (React Flow v12) |
| Bundler | esbuild (webview), tsc (extension host) |
| Tests | Vitest |
| Validation | Zod |

---

## Security Model

- No secrets in code — `ANTHROPIC_API_KEY` via env only
- Agent output stays in VFS until user clicks Approve
- All LLM tool calls read-only (`@security` JSDoc everywhere)
- SAST rules: no `any`, no hardcoded secrets, max 150 lines/file
- `TypeScriptService.getDiagnostics(path, sourceOverride)` — staged source never touches disk

---

## Roadmap

See [NEXUS_ROADMAP.md](NEXUS_ROADMAP.md) for the full phase plan.

| Phase | Goal |
|-------|------|
| 6 | VFS → Real FS: write approved artifacts to disk via VS Code workspace API |
| 7 | Shadow Build: `tsc --noEmit` in a temp dir against VFS content before approval |
| 8 | Multi-model: swap Anthropic for Gemini / Ollama via `ILLMGateway` |
| 9 | VS Code Tree View sidebar for staged VFS diff |
| 10 | `.vsix` packaging + extension marketplace publish |
