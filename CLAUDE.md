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