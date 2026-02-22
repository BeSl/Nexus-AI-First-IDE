# 🗺️ Nexus Agent IDE: Roadmap & Implementation Plan

Этот документ описывает поэтапный процесс создания кроссплатформенной IDE на базе Code-OSS,
оптимизированной для разработки исключительно через ИИ-агентов с использованием фреймворка AgentTS.

---

## 🏗 Фаза 1: Инфраструктура и "Зрение" (MVP)

**Цель:** Подготовить среду Code-OSS и научить ИИ понимать структуру проекта без перерасхода токенов.

### 1.1. Setup Code-OSS Environment

- [x] Форкнуть репозиторий VS Code (Code-OSS) — `build-scripts/clone-vscode.mjs`
- [x] Настроить патч-систему (`patches/NNNN-scope-desc.patch`, `apply-patches.mjs`)
- [ ] Очистить от телеметрии Microsoft (patches 0001–0099)
- [ ] Настроить сборку под основные платформы (Web, Desktop)

### 1.2. Context Engine (Core) ✅

- [x] Парсер на базе TypeScript Compiler API — `skeleton-transformer.ts`
- [x] SkeletonProvider — генератор скелетов без тел функций (22/22 тестов)
- [x] ContextEngine — keyword ranking + token budget (13/13 тестов)
- [x] TFIDFVectorIndex — локальный векторный индекс TF-IDF (10/10 тестов)

### 1.3. LLM Gateway ✅

- [x] AnthropicGateway — `@anthropic-ai/sdk` wrapper, `complete()` + `stream()` (9/9 тестов)
- [x] MCP Tool registration — `registerTools()` / `MCPTool` interface
- [x] `LLMGateway.types.ts` — `ILLMGateway`, `LLMMessage`, `LLMChunk`, `LLMResponse`

---

## 🤖 Фаза 2: Оркестрация и Инструментарий (Alpha)

**Цель:** Создать систему команд, с помощью которых ИИ будет изменять код и проверять себя.

### 2.1. Agent Orchestrator ✅

- [x] XState машина состояний — `core/orchestrator.machine.ts` (7/7 тестов)
- [x] idle → architect → awaitingApproval → coder → reviewer → tester → done
- [x] Роли: Architect, Coder, Reviewer, Tester — через `IAgentRunner` DI
- [x] `OrchestratorService` — DI wiring (`core/orchestrator.ts`)

### 2.2. Virtual File System (VFS) ✅

- [x] `IVirtualFileSystem` контракт — `core/vfs.types.ts`
- [x] `InMemoryVFS` — staged writes sandbox, `confirm()` → real disk (17/17 тестов)
- [x] `PendingChange`, `ChangeSet`, `DiffSummary` — полный diff API

### 2.3. Shadow Build System ✅

- [x] `BuildOrchestrator` — shadow build pipeline (16/16 тестов)
- [x] `ShadowFS` — изоляция в `~/.nexus/shadow-build/<taskId>`
- [x] `ErrorAnalyzer` — парсинг tsc/esbuild ошибок + auto-fix (TS2307, TS7006)
- [x] `IBuildRunner` — injectable execSync wrapper

---

## 🤖 Агент-персоны (реализовано)

- [x] **CoderAgent** — реализует интерфейсы от Architect, retry-loop с BuildFeedback (9/9 тестов)
- [x] **ReviewerAgent** — статический анализ (NEXUS-001…008) + LLM review (9/9 тестов)
- [x] **TesterAgent** — генерация Vitest тестов для каждого артефакта (9/9 тестов)

---

## 🔌 Связка компонентов (Critical — реализовано)

- [x] **LLM Tool Binding** — `AgentToolkit`: ContextEngine + VectorIndex + SkeletonProvider как MCP tools (11/11 тестов)
- [x] **VFS Sync** — `VFSCommitter`: git commit после `InMemoryVFS.confirm()` (9/9 тестов)
- [x] **Agent Prompt Templates** — `ArchitectAgent` + системный промпт + `prompts.ts` (8/8 тестов)
- [x] **Shadow Build Feedback Loop** — `BuildFeedback`: форматирование ошибок BuildResult для Coder агента (11/11 тестов)

---

## 🛡 Фаза 3: AgentTS и Enterprise-контроль (Beta)

**Цель:** Внедрить строгие правила разработки, которые сделают код поддерживаемым и безопасным.

### 3.1. AgentTS Framework ✅

- [x] **NexusLinter** — NEXUS-001…008: no-any, no-secrets, no-direct-fs, JSDoc, max-lines, private-hash, no-console, implements (20/20 тестов)
- [x] **ContractValidator** — Contract-First: проверяет .types.ts перед имплементацией (11/11 тестов)
- [x] `agent-ts/index.ts` — публичный API агентского DSL

### 3.2. Human-in-the-Loop Dashboard ✅ (protocol layer)

- [x] **webview.types.ts** — протокол Extension↔Webview: OrchestratorState, Diff, BuildResult, Approve/Reject/Cancel
- [x] **OrchestratorBridge** — XState → WebviewMessage, дедупликация состояний (13/13 тестов)
- [ ] React Flow Webview компонент (Фаза 4)

### 3.3. TDD Automation ✅

- [x] **TesterAgent** — генерирует Vitest тесты параллельно с реализацией

---

## 🚀 Фаза 4: Масштабирование и Релиз

**Цель:** Оптимизация под высокие нагрузки и кроссплатформенную разработку.

### 4.1. Cross-Platform SDKs ✅

- [x] **BlueprintRegistry** — 4 встроенных шаблона: `node-backend`, `electron`, `react-native`, `web-extension`
- [x] Переменная интерполяция `{{name}}`, `{{author}}`, `{{description}}` — без eval (14/14 тестов)
- [x] Extensible API — `registry.register(customBlueprint)`

### 4.2. Security Layer ✅

- [x] **SastRunner** — SAST через NexusLinter перед Reviewer (11/11 тестов)
- [x] **NexusAgentFactory** — DI-сборка всех агентов + `indexProject()` для pre-indexing
- [x] **NodeFileReader** + `collectTsFiles()` — production IFileReader с glob

### 4.3. Plugin System ✅

- [x] **plugin.types.ts** — `IAgentPlugin`, `PluginManifest`, `PluginActorInput`
- [x] **PluginRegistry** — регистрация кастомных агентов по слотам (reviewer/tester/post-tester), semver-валидация (13/13 тестов)

### XState Actor Runners ✅

- [x] **runArchitect.ts** — исправлен, использует ArchitectAgent через NexusAgentFactory
- [x] **runCoder.ts** — CoderAgent actor с retry + buildFeedback
- [x] **runReviewer.ts** — ReviewerAgent actor, бросает Error при critical violations
- [x] **runTester.ts** — TesterAgent actor

### UI ✅

- [x] **NexusApprovalPanel.ts** — исправлен (Artifact.path вместо uri, callback-based API)

---

## 🛠 Технологический стек

| Компонент        | Технология                             |
|-----------------|----------------------------------------|
| Основа IDE      | Code-OSS 1.96.4 (VSCodium-style fork)  |
| Язык            | TypeScript 5.9 (Strict Mode)           |
| Логика агентов  | XState 5                               |
| LLM             | Claude (Anthropic SDK) + MCP           |
| Контекст        | TF-IDF (Phase 1) → Embeddings (Phase 2)|
| Тестирование    | Vitest                                 |
| Валидация       | Zod                                    |
| Build isolation | `~/.nexus/shadow-build/`               |

---

## 📈 Метрики успеха (KPI)

- **Token Efficiency:** Снижение веса контекста на 70% через скелеты (достигнуто: 60–80%)
- **Success Rate:** Минимум 90% успешных Shadow Builds с первого промпта
- **Safety:** 0 критических уязвимостей, пропущенных Security-агентом

---

## 📊 Текущий статус тестов

| Модуль                        | Тесты   | Статус       |
|-------------------------------|---------|--------------|
| `core/orchestrator.machine`   | 7/7     | ✅ реализован |
| `src/core/context/SkeletonProvider` | 22/22 | ✅ реализован |
| `src/core/context/ContextEngine`   | 13/13 | ✅ реализован |
| `src/core/context/VectorIndex`     | 10/10 | ✅ реализован |
| `src/core/vfs/InMemoryVFS`         | 17/17 | ✅ реализован |
| `src/core/builder/BuildOrchestrator` | 16/16 | ✅ реализован |
| `src/core/llm/AnthropicGateway`    | 9/9   | ✅ реализован |
| `src/core/llm/AgentToolkit`        | 11/11 | ✅ реализован |
| `src/core/vfs/VFSCommitter`        | 9/9   | ✅ реализован |
| `src/core/builder/BuildFeedback`   | 11/11 | ✅ реализован |
| `agents/architect/ArchitectAgent`  | 8/8   | ✅ реализован |
| `agents/coder/CoderAgent`          | 9/9   | ✅ реализован |
| `agents/reviewer/ReviewerAgent`    | 9/9   | ✅ реализован |
| `agents/tester/TesterAgent`        | 9/9   | ✅ реализован |
| `agent-ts/NexusLinter`             | 20/20 | ✅ реализован |
| `agent-ts/ContractValidator`       | 11/11 | ✅ реализован |
| `src/ui/OrchestratorBridge`        | 13/13 | ✅ реализован |
| `src/core/security/SastRunner`     | 11/11 | ✅ реализован |
| `src/core/plugins/PluginRegistry`  | 13/13 | ✅ реализован |
| `src/core/blueprints/BlueprintRegistry` | 14/14 | ✅ реализован |
| **Итого**                          | **242/242** | ✅        |

План развития: От инфраструктуры к Интеллекту
1. Реализация конкретных Агентов (Personas)
Сейчас у тебя есть машина состояний, но «актеры» еще не знают своих ролей.

Architect Agent: Должен уметь анализировать SkeletonProvider и выдавать структуру новых файлов. Задача: Реализовать промпт-инженерную логику для генерации архитектурных планов в формате JSON.

Coder Agent: Должен работать в связке с InMemoryVFS. Задача: Реализовать итеративное исправление кода на основе ошибок из BuildOrchestrator.

Reviewer & Tester: Самое важное для Enterprise. Задача: Агент-ревьюер должен сверять код с файлом .nexus-rules (статический анализ через LLM).

2. UI: Визуализация Мышления (ArchitectureGraph)
Без визуализации пользователю будет сложно доверять агенту.

Webview интеграция: Создать панель в Code-OSS (React + React Flow).

Live Stream: Визуализация переходов XState-машины в реальном времени. Пользователь должен видеть: «Ага, сейчас агент в состоянии reviewer, он проверяет типы».

Impact Analysis: Подсветка узлов графа, которые затронет текущая задача.

3. LSP Layer: Глубокое понимание кода
Это то, что отличает IDE от простого чата.

Cross-file Go-to-Definition: Интеграция с TypeScript LSP, чтобы агент мог «прыгать» по определениям, как это делает разработчик.

Type Coverage Reporter: Инструмент, который говорит агенту: «Ты написал код, но уровень покрытия типами упал, исправь».

4. Очистка и Патчинг Code-OSS (Enterprise Hardening)
Чтобы предлагать это Google или другим компаниям, IDE должна быть "чистой".

Telemetry Nuker: Автоматизировать применение патчей 0001–0099 для удаления всех vortex.data.microsoft.com и прочих эндпоинтов.

Custom Branding: Замена иконок, названий и стартового экрана на Nexus AI.

Задача,Описание,Приоритет
LLM Tool Binding,"Связать AnthropicGateway с методами SkeletonProvider и VectorIndex, чтобы Claude мог сам вызывать поиск.",🔥 Critical
VFS Sync,Реализовать механизм Apply Changes (перенос из InMemoryVFS в реальную файловую систему с созданием Git-коммита).,🔥 Critical
Agent Prompt Templates,"Написать системные промпты для каждой роли (Architect, Coder и т.д.) на основе .nexus-rules.",🟡 High
Shadow Build Feedback Loop,Настроить автоматическую передачу ошибок компиляции (из stdout) обратно в контекст Coder-агента.,🟡 High

Фаза: Непробиваемая Инфраструктура (CI/CD & Code Quality)
Цель: Сделать репозиторий готовым к Open Source контрибьюциям и показать Enterprise-уровень (зеленые бейджики в GitHub).

Промпт для Claude:

Context: I am preparing the Nexus-AI-First-IDE project for a public GitHub release. The goal is to make it Enterprise-ready (Google/BigTech standards). We already have 94 passing tests locally.

Task:

Create a GitHub Actions workflow file (.github/workflows/test.yml) that runs npm test on every push and pull request to the main branch. Ensure it uses Node.js 20.

Set up Husky and lint-staged in the repository.

Create a basic .eslintrc.js and .prettierrc configured for a TypeScript monorepo (workspaces: core, agents, agent-ts).

Add a pre-commit hook that runs the linter and formats the staged files before allowing a commit.

Constraint: Do not break existing tests. Provide the exact terminal commands I need to run to install these devDependencies and initialize Husky.

Фаза: Интеграция Webview UI (Architect Approval Panel)
Цель: Оживить машину состояний XState. Когда система переходит в состояние awaitingApproval, в VS Code должна открываться Material Design панель с планом от ИИ-Архитектора.

Промпт для Claude:

Context: In our Nexus-AI-First-IDE, the XState orchestrator (orchestrator.machine.ts) transitions to the awaitingApproval state after the Architect agent generates a JSON plan of artifacts.

Task:

Implement the NexusApprovalPanel class (using VS Code Webview API) that renders an array of Artifact objects (URI, type: 'new'|'update', reason, content snippet).

The UI must follow VS Code's native look and feel (using CSS variables like var(--vscode-button-background)).

Add two buttons to the Webview: "Approve Plan" and "Reject Plan".

Wire the Webview messages back to the XState machine:

"Approve" should trigger the USER_APPROVED event (moving to the coder state).

"Reject" should trigger the USER_REJECTED event.

Update orchestrator.machine.ts to call this Webview panel as an entry action when entering the awaitingApproval state.

Constraint: Ensure the Webview correctly handles state serialization and doesn't memory-leak if closed and reopened.

Фаза : Coder Agent и Shadow Build Integration
Цель: Замкнуть цикл. После апрува Архитектора, Кодер должен написать реальный код в Виртуальную Файловую Систему (VFS) и запустить фоновую проверку.

Промпт для Claude:

Context: The user has approved the Architect's plan in Nexus-AI-First-IDE. The XState machine is now in the coder state. We have an array of approved Artifact objects (containing signatures/types).

Task:

Implement the runCoder.ts XState actor (using fromPromise).

The Coder agent should receive the approved artifacts and the user's original intent.

Write a system prompt for the Coder: "You are the Nexus Coder. Your job is to implement the function bodies for the provided artifacts. Return a JSON array of files with their full implementation."

Call the LLM (e.g., AnthropicGateway) to generate the code.

Parse the LLM response and write the generated files into our InMemoryVFS (Virtual File System).

Trigger the ShadowBuild process on the VFS to verify there are no TypeScript errors.

If the build passes, return success to the orchestrator. If it fails, return the error log so the XState machine can loop back for self-healing.

Constraint: Do NOT write to the physical disk yet. All changes must happen inside InMemoryVFS until the final Done state.