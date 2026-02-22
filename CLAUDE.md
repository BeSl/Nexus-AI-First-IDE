Project "Nexus Agent IDE"
1. Vision & Core Principles
This project aims to build a modern IDE (based on VS Code/Code-OSS) designed for AI-First Development.

Human as Architect: The user defines architecture and intent; AI agents implement logic.

AgentTS Framework: A strict architectural wrapper over TypeScript that enforces modularity and test-driven development (TDD).

Contract-First: No implementation logic without pre-defined TypeScript interfaces and unit tests.

Cross-Platform: Target Web, Desktop (Electron), and Mobile (React Native).

2. Technical Stack
Base: VS Code Extension API / Custom Code-OSS distribution.

Language: TypeScript (Strict Mode).

State Management: XState (for Agentic workflows and state machines).

Communication: LSP (Language Server Protocol) & MCP (Model Context Protocol).

Validation: Zod for runtime schema validation.

3. Agent Rules & Constraints (Critical)
When acting as an agent in this repository, follow these rules:

A. Architectural Integrity
Isolation: Each component/module must be decoupled. Use Dependency Injection.

No Spaghetti: Max file length: 150 lines. If larger, decompose.

Directory Structure:

/core: Orchestration and Agent management.

/agents: Specific agent personas (Architect, Coder, Reviewer, Tester).

/agent-ts: The DSL/Wrapper logic for TypeScript.

/ui: VS Code Webview panels for visual architecture.

B. Development Workflow (The Nexus Loop)
Define Contract: Create/Update interface in .types.ts.

Write Test: Create .spec.ts matching the contract.

Implement: Write minimal code to pass tests.

Review: Run static analysis for security and performance.

C. Security & Enterprise Standards
Every AI-generated function must have JSDoc with @security audit notes.

No hardcoded secrets. Use environment variable templates.

Ensure all dependencies are from a pre-approved whitelist (Enterprise-ready).

4. Commands & Scripts
npm run dev: Start VS Code extension in debug mode.

npm run test: Run Vitest suite.

npm run lint: Strict ESLint check (includes AI-specific rules).

npm run build:agent-ts: Compiles the AgentTS wrapper.

5. Active Context
Current Task: Building the "Intent Layer" — a bridge between natural language prompts and the VS Code File System.

Next Step: Implement the ArchitectureGraph component using React Flow in a VS Code Webview.

### AI Context Strategy
- **Token Efficiency:** Always prefer `FileSkeleton` over full file content unless editing is required.
- **Reference Tracking:** Before making changes, the agent MUST call `getRelevantContext` to identify side effects.
- **No Global Scans:** Avoid `grep`-like operations on the whole project. Use the Semantic Index.
**Strategic Goal:** Project Nexus is being built as a potential acquisition/partnership target for Google. Every line of code must follow Enterprise-grade patterns: Type-safety, Hexagonal Architecture, and Deterministic Orchestration (XState).

## Git Workflow & Release Rules
You must strictly follow this branching strategy for all development:

1. **Never commit directly to `main`:** The `main` branch is our single source of truth and must always be stable (green CI).
2. **Feature Branches:** All new development (features, refactoring, bug fixes) must happen in a dedicated branch created from `main`.
   - Naming convention: `feat/feature-name`, `fix/bug-name`, `refactor/module-name`.
3. **Atomic Commits:** Make small, logical commits with clear, descriptive messages (e.g., `feat(ui): add NexusApprovalPanel webview`).
4. **Pull Requests (PRs):** Once a feature is complete and all tests pass locally (`npm test`), we merge it into `main` via a Pull Request (or simulated PR merge if working locally).
5. **Releases:** Releases are cut from `main` after successful integration and testing.