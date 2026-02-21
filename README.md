# Nexus Agent IDE

> AI-First IDE built on Code-OSS/VSCodium — Human as Architect, AI as Implementor.

## Architecture

```
nexus-agent-ide/
├── core/           # Orchestration & Agent management
├── agents/         # Agent personas (Architect, Coder, Reviewer, Tester)
│   ├── architect/
│   ├── coder/
│   ├── reviewer/
│   └── tester/
├── agent-ts/       # AgentTS DSL/Wrapper for TypeScript
├── ui/             # VS Code Webview panels (React Flow, ArchitectureGraph)
├── patches/        # Git patches applied to vscode-src
├── build-scripts/  # Clone, patch, build automation
└── vscode-src/     # Code-OSS source (git-ignored, fetched by build)
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Fetch Code-OSS source (VSCode 1.96.4 — current LTS)
npm run vscode:clone

# 3. Apply Nexus patches
npm run patch:apply

# 4. Start development
npm run dev
```

## The Nexus Loop (Development Workflow)

1. **Define Contract** → Create/update `.types.ts`
2. **Write Test** → Create `.spec.ts` matching the contract
3. **Implement** → Minimal code to pass tests
4. **Review** → `npm run lint` (ESLint + security audit)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Base IDE | Code-OSS (VSCodium fork) |
| Language | TypeScript 5.x (Strict Mode) |
| State | XState 5 |
| Validation | Zod |
| Protocol | LSP + MCP |
| Tests | Vitest |
