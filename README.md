# Nexus Agent IDE

> AI-First IDE built on Code-OSS/VSCodium — Human as Architect, AI as Implementor.

## Architecture

```
nexus-agent-ide/
├── core/                        # Contracts & orchestration
│   ├── orchestrator.types.ts    # AgentTask, AgentResult, IOrchestratorService
│   ├── orchestrator.machine.ts  # XState: idle→architect→coder→reviewer→tester→done
│   ├── orchestrator.ts          # OrchestratorService (DI wiring)
│   ├── context-engine.types.ts  # IContextEngine, FileSkeleton, ContextQuery
│   └── vfs.types.ts             # IVirtualFileSystem (staged writes sandbox)
│
├── src/core/
│   ├── context/
│   │   ├── ContextEngine.ts          # IContextEngine impl: keyword ranking + token budget
│   │   ├── SkeletonProvider.ts       # fromContent / fromFile / fromDirectory
│   │   ├── skeleton-transformer.ts   # TypeScript Compiler API → text splice
│   │   └── SkeletonProvider.types.ts # ISkeletonProvider, SkeletonResult
│   └── builder/
│       ├── BuildOrchestrator.ts      # Shadow build pipeline
│       ├── ShadowFS.ts               # ~/.nexus/shadow-build/<taskId> isolation
│       ├── ErrorAnalyzer.ts          # tsc/esbuild error parser + auto-fix
│       └── BuildRunner.ts            # execSync wrapper (injectable)
│
├── agents/
│   └── architect/
│       └── architect.types.ts        # IArchitectAgent, ParsedIntent, ModuleBlueprint
│
├── patches/                     # Git patches applied to vscode-src (naming: NNNN-scope-desc.patch)
├── build-scripts/               # Clone, patch, build automation
│   ├── clone-vscode.mjs         # Shallow-clone vscode@1.96.4
│   ├── apply-patches.mjs        # Apply /patches/*.patch in order
│   └── vscode-version.json      # { tag, sha, vscodiumBase }
└── vscode-src/                  # Code-OSS source (git-ignored, ~700MB)
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Fetch Code-OSS source (VSCode 1.96.4, shallow clone)
npm run vscode:clone

# 3. Apply Nexus patches (none yet — first run is a no-op)
npm run patch:apply

# 4. Run tests
npm test

# 5. Start development
npm run dev
```

## The Nexus Loop (Development Workflow)

```
Intent (natural language)
  ↓
ContextEngine.query()      ← skeletons only, no implementation
  ↓
Architect Agent            ← designs interfaces, never code
  ↓
[User approves blueprint]  ← awaitingApproval gate in XState
  ↓
Coder Agent                ← implements against the contracts
  ↓
Reviewer Agent             ← static analysis, security audit
  ↓
Tester Agent               ← generates & runs tests
  ↓
BuildOrchestrator          ← shadow build in ~/.nexus/shadow-build/
  ↓
[User confirms VFS diff]   ← VFS.confirm() writes to real disk
```

**Rule:** Agents NEVER read files directly — only via `ContextEngine.query()`.

## Implementation Status

| Module | Status | Tests |
|--------|--------|-------|
| `core/orchestrator.machine` | ✅ XState machine | 7/7 |
| `core/orchestrator` | ✅ OrchestratorService (DI) | — |
| `core/context-engine.types` | ✅ Contracts | — |
| `core/vfs.types` | ✅ Contracts | — |
| `src/core/context/SkeletonProvider` | ✅ TypeScript Compiler API | 22/22 |
| `src/core/context/ContextEngine` | ✅ Keyword ranking + token budget | 13/13 |
| `src/core/builder/BuildOrchestrator` | ✅ Shadow build pipeline | 16/16 |
| `src/core/builder/ErrorAnalyzer` | ✅ tsc/esbuild parser + auto-fix | — |
| `src/core/llm/AnthropicGateway` | ✅ Claude API + MCP | 9/9 |
| `src/core/context/VectorIndex` | ✅ TF-IDF vector index | 10/10 |
| `src/core/vfs/InMemoryVFS` | ✅ Staged writes + confirm | 17/17 |
| `agents/architect` | 🔲 Contracts only | — |
| LSP Layer | 🔲 Planned | — |
| ArchitectureGraph (Webview) | 🔲 Planned | — |

**Total: 94/94 tests passing**

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Base IDE | Code-OSS 1.96.4 (VSCodium-style fork) |
| Language | TypeScript 5.9 (Strict Mode) |
| State machines | XState 5 |
| Validation | Zod |
| AST parsing | TypeScript Compiler API |
| Protocol | LSP + MCP (planned) |
| Tests | Vitest |
| Build isolation | `~/.nexus/shadow-build/` |

## Key Design Decisions

### SkeletonProvider — TypeScript Compiler API
Uses **text splice** (not AST re-print) to preserve JSDoc comments naturally.
All function/method bodies → `{ /* implementation hidden */ }`.
Private/protected class members removed entirely.

### ContextEngine — Phase 1 Keyword Ranking
No embedding API required. Scores files by token overlap with `intent` string.
`scope` filter narrows candidates, `maxTokens` caps the response budget.
Phase 2: swap `overlap()` for real cosine similarity on embeddings.

### BuildOrchestrator — Shadow Build Isolation
Never touches real project FS. All changes staged in VFS first.
Shadow dir `~/.nexus/shadow-build/<taskId>` is always cleaned up (even on error).
`IBuildRunner` is injected → `execSync` never runs in unit tests.
