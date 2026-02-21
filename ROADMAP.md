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

## 🔌 Связка компонентов (Critical — реализовано)

- [x] **LLM Tool Binding** — `AgentToolkit`: ContextEngine + VectorIndex + SkeletonProvider как MCP tools (11/11 тестов)
- [x] **VFS Sync** — `VFSCommitter`: git commit после `InMemoryVFS.confirm()` (9/9 тестов)
- [x] **Agent Prompt Templates** — `ArchitectAgent` + системный промпт + `prompts.ts` (8/8 тестов)
- [x] **Shadow Build Feedback Loop** — `BuildFeedback`: форматирование ошибок BuildResult для Coder агента (11/11 тестов)

---

## 🛡 Фаза 3: AgentTS и Enterprise-контроль (Beta)

**Цель:** Внедрить строгие правила разработки, которые сделают код поддерживаемым и безопасным.

### 3.1. AgentTS Framework

- [ ] Набор ESLint/Biome правил, блокирующих "плохой" код от ИИ
- [ ] Contract-First Engine: запрет на генерацию логики без предварительных интерфейсов

### 3.2. Human-in-the-Loop Dashboard

- [ ] UI-панель "Review & Diff" (VS Code Webview) — одобрение изменений поблочно
- [ ] Визуализация графа зависимостей (React Flow)

### 3.3. TDD Automation

- [ ] Агент-тестировщик — пишет тесты на Vitest/Playwright параллельно с кодом

---

## 🚀 Фаза 4: Масштабирование и Релиз

**Цель:** Оптимизация под высокие нагрузки и кроссплатформенную разработку.

### 4.1. Cross-Platform SDKs

- [ ] Шаблоны (Blueprints) для React Native, Electron и Backend (Node/Bun)

### 4.2. Security Layer

- [ ] Автоматический аудит безопасности (SAST) для каждой итерации кода

### 4.3. Plugin System

- [ ] API для создания кастомных агентов под специфические нужды Enterprise

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
| **Итого**                          | **133/133** | ✅        |

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