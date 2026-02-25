# Nexus Agent IDE — Контекст для Qwen

## Обзор проекта

**Nexus Agent IDE** — это VS Code extension, реализующее мульти-агентный цикл (Architect → Coder → Reviewer → Tester) для автоматической разработки TypeScript-кода. Ключевой принцип: **Human as Architect — agents as implementers**.

### Основные характеристики

- **Тип проекта**: VS Code extension (TypeScript)
- **Ядро**: XState 5 машина состояний для детерминированной оркестрации
- **LLM Gateway**: Anthropic Claude / Google Gemini / Ollama через MCP protocol
- **Контекст**: TF-IDF векторный индекс + TypeScript Compiler API (SkeletonProvider)
- **VFS**: In-memory файловая система с staged writes (требует approval пользователя)
- **UI**: React 19 + React Flow v12 для визуализации графа состояний
- **Тесты**: 263 теста через Vitest, `tsc --strict` без ошибок

---

## Структура проекта

```
nexus-agent-ide/
├── core/                    # Общие контракты (XState machine, VFS types, orchestrator)
├── src/
│   ├── core/
│   │   ├── context/         # ContextEngine, VectorIndex, SkeletonProvider
│   │   ├── llm/             # AnthropicGateway, AgentToolkit, MCP tools
│   │   ├── lsp/             # TypeScriptService (Compiler API diagnostics)
│   │   ├── builder/         # BuildOrchestrator, ShadowFS, ErrorAnalyzer
│   │   ├── security/        # SastRunner + NexusLinter правила
│   │   ├── vfs/             # InMemoryVFS, WorkspaceCommitter
│   │   ├── telemetry/       # TelemetryService (token tracking)
│   │   ├── blueprints/      # BlueprintRegistry (шаблоны проектов)
│   │   ├── plugins/         # PluginRegistry (расширяемость)
│   │   └── NexusAgentFactory.ts  # DI сборка всех агентов
│   ├── extension.ts         # VS Code entry point, команды, sidebar views
│   ├── NexusLoop.ts         # XState actor wiring → NexusGraphPanel
│   └── NexusConfig.ts       # Чтение настроек из VS Code configuration
├── agents/
│   ├── architect/           # ArchitectAgent (дизайн интерфейсов)
│   ├── coder/               # CoderAgent (реализация кода)
│   ├── reviewer/            # ReviewerAgent (SAST + code review)
│   ├── tester/              # TesterAgent (генерация Vitest тестов)
│   └── run*.ts              # XState actor wrappers для каждого агента
├── agent-ts/                # AgentTS DSL (NexusLinter, ContractValidator)
├── ui/
│   ├── NexusGraphPanel.ts   # React Flow DAG визуализация
│   ├── NexusApprovalPanel.ts# Панель approval плана архитектора
│   ├── NexusWelcomePanel.ts # Мастер первоначальной настройки
│   ├── NexusVfsProvider.ts  # Sidebar provider для staged файлов
│   ├── NexusStatusProvider.ts# Sidebar provider статуса конфигурации
│   └── webview.types.ts     # Extension↔Webview протокол
├── webview-src/             # React Flow app (browser bundle, esbuild)
├── build-scripts/           # esbuild + tsc автоматизация
├── patches/                 # Патчи для Code-OSS (телеметрия и др.)
└── dist/                    # Скомпилированный output (git-ignored)
```

---

## Сборка и запуск

### Пререквизиты

- Node.js ≥ 18, npm ≥ 9
- VS Code ≥ 1.96
- API-ключ для Anthropic/Gemini **или** локальный Ollama

### Установка и компиляция

```bash
npm install

# Компиляция extension host (TypeScript → dist/)
npm run compile

# Сборка React Flow webview (esbuild → dist/webview/)
npm run build:webview

# Или всё вместе
npm run build
```

### Запуск в режиме отладки

Нажмите **F5** в VS Code (Extension Development Host).

### Тесты

```bash
npm test           # Запустить все тесты (263 теста)
npm run test:watch # Watch mode
```

### Линтинг

```bash
npm run lint       # ESLint + AI-specific правила
```

### Переменные окружения

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export GEMINI_API_KEY=AIza...
export OLLAMA_BASE_URL=http://localhost:11434
export OPENAI_API_KEY=sk-...        # для openai-compatible
export OPENAI_BASE_URL=https://api.openai.com/v1  # или другой совместимый endpoint
export OPENAI_MODEL=gpt-4           # модель по умолчанию
```

---

## Архитектурные компоненты

### 1. XState Orchestrator (`core/orchestrator.machine.ts`)

Детерминированная машина состояний:

```
idle → architect → awaitingApproval → coder → shadowBuild → reviewer → tester → done
                                              ↑_______________|
                                                   (retry on TS error)
```

**Гарды**:
- `awaitingApproval`: требует USER_APPROVED перед coder
- `shadowBuild`: при ошибке TS → retry coder (макс. 3 попытки)
- `MAX_RETRIES = 3` в машине состояний

### 2. Агент-персоны

| Агент | Обязанность | Артефакты |
|-------|-------------|-----------|
| **Architect** | Анализ intent, дизайн `.types.ts` интерфейсов | JSON план файлов |
| **Coder** | Реализация кода по интерфейсам, retry с buildFeedback | `.ts` файлы |
| **Reviewer** | SAST (no `any`, no secrets), code review | violation report |
| **Tester** | Генерация `.spec.ts` тестов для каждого модуля | Vitest тесты |

### 3. LLM Gateway (`src/core/llm/`)

- **AnthropicGateway**: `@anthropic-ai/sdk`, streaming + MCP tools
- **GeminiGateway**: Google Gemini REST API v1beta
- **OllamaGateway**: локальный Ollama REST API
- **OpenAICompatibleGateway**: любой OpenAI API совместимый endpoint (OpenAI, OpenRouter, Azure, vLLM, llama.cpp)
- **GatewayFactory**: абстракция для мульти-провайдера (anthropic/gemini/ollama/openai-compatible)
- **AgentToolkit**: регистрация MCP tools (context_query, vector_search, ts_diagnostics)

**Важно**: Все gateway используют `Content-Type: application/json; charset=utf-8` для корректной работы с UTF-8 (кириллица и др.).

### 4. Context Engine (`src/core/context/`)

- **SkeletonProvider**: генерирует скелеты файлов (сигнатуры без тел) через TS Compiler API
- **TFIDFVectorIndex**: локальный TF-IDF индекс для semantic search
- **ContextEngine**: keyword ranking + token budget для эффективного контекста

### 5. VFS (`src/core/vfs/`)

- **InMemoryVFS**: staged writes, `confirm()` → real disk
- **WorkspaceCommitter**: запись approved файлов через VS Code workspace API

### 6. AgentTS (`agent-ts/`)

DSL для enforcement правил:

- **NexusLinter**: NEXUS-001…008 (no-any, no-secrets, max-lines, JSDoc @security)
- **ContractValidator**: проверка `.types.ts` перед имплементацией

### 7. UI Components

- **NexusGraphPanel**: React Flow DAG (визуализация XState transitions)
- **NexusApprovalPanel**: карточки артефактов с Approve/Reject кнопками
- **NexusVfsProvider**: sidebar tree для staged файлов
- **NexusWelcomePanel**: wizard первоначальной настройки

---

## Ключевые команды VS Code

| Команда | Описание |
|---------|----------|
| `nexus.run` | Запустить агентный цикл (prompt для intent) |
| `nexus.showGraph` | Открыть React Flow DAG |
| `nexus.showWelcome` | Мастер настройки |
| `nexus.vfs.approveAll` | Записать все staged файлы на диск |
| `nexus.vfs.discardAll` | Отбросить staged файлы |
| `nexus.vfs.preview` | Preview staged файла в read-only editor |

---

## Конвенции разработки

### TypeScript

- **Strict mode**: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **Модули**: `NodeNext`, `moduleResolution: NodeNext`
- **Максимум строк в файле**: 150 ( enforced через NexusLinter)
- **JSDoc**: обязательно `@security` для всех функций

### Архитектурные принципы

1. **Isolation**: каждый модуль decoupled, Dependency Injection через `NexusAgentFactory`
2. **No spaghetti**: файл > 150 строк → рефакторинг
3. **Contract-First**: сначала `.types.ts` интерфейсы, потом имплементация
4. **Token Efficiency**: предпочитать `FileSkeleton` полному контенту

### Безопасность

- API-ключи **только** через env/VS Code settings (никогда в коде)
- Все LLM tool calls — read-only (`@security` JSDoc)
- Agent output → VFS → user approval → disk
- SAST перед записью: no `any`, no secrets, no direct FS access

### Git workflow

- **main**: стабильная ветка (зелёный CI)
- **feature branches**: `feat/*`, `fix/*`, `refactor/*`
- **Atomic commits**: маленькие логические коммиты
- **PR**: merge в main после `npm test`

---

## Технологический стек

| Слой | Технология |
|------|------------|
| Language | TypeScript 5.4+ (strict) |
| State Machine | XState 5 |
| LLM | Anthropic / Gemini / Ollama / OpenAI-compatible (MCP protocol) |
| AST/LSP | TypeScript Compiler API (in-process) |
| UI | React 19 + @xyflow/react (React Flow v12) |
| Bundler | esbuild (webview), tsc (extension) |
| Tests | Vitest |
| Validation | Zod |
| Packaging | @vscode/vsce |

**Поддерживаемые LLM-провайдеры**:
- **Anthropic** (`claude-sonnet-4-6`) — лучшее качество кода
- **Google Gemini** (`gemini-2.0-flash`) — быстрый, есть бесплатный уровень
- **Ollama** (любая модель) — локально, без интернета
- **OpenAI-compatible** — любой совместимый API (OpenAI, OpenRouter, Azure, vLLM, llama.cpp)

---

## Расширение функциональности

### Добавление нового агента

1. Создать класс в `agents/<role>/` с интерфейсом `IAgent<Role>`
2. Добавить actor в `orchestrator.machine.ts`
3. Зарегистрировать в `NexusAgentFactory.createNexusAgents()`
4. Добавить XState actor wrapper в `agents/run<Role>.ts`

### Добавление MCP tool

1. Реализовать `MCPTool` интерфейс в `src/core/llm/`
2. Зарегистрировать через `AgentToolkit.registerTools()`
3. Tool будет доступен всем агентам через `ILLMGateway`

### Добавление плагина

1. Реализовать `IAgentPlugin` с `PluginManifest`
2. Зарегистрировать через `PluginRegistry.register()`
3. Плагин может перехватывать слоты: `reviewer`, `tester`, `post-tester`

---

## Отладка

### Логирование XState переходов

В `NexusLoop.start()` подписка на `actor.subscribe()` логирует каждое состояние.

### VFS inspection

Sidebar **Staged Files** показывает все файлы до commit. Клик → preview.

### Telemetry

`TelemetryService.getSummary()` возвращает:
- `cycles`: количество агентных циклов
- `estimatedCostUsd`: оценка стоимости по токенам (Anthropic/Gemini тарифы)

---

## Roadmap (активные фазы)

| Фаза | Цель | Статус |
|------|------|--------|
| 6 | VFS → Real FS commit | ✅ реализовано |
| 7 | Shadow Build (tsc --noEmit в temp) | ✅ реализовано |
| 8 | Multi-model (Gemini/Ollama) | ✅ реализовано |
| 9 | VS Code Tree View для VFS diff | ✅ реализовано (NexusVfsProvider) |
| 10 | .vsix packaging + marketplace | 🔄 в работе |

---

## Важные файлы для контекста

| Файл | Описание |
|------|----------|
| `core/orchestrator.machine.ts` | XState машина — сердце Nexus Loop |
| `src/extension.ts` | VS Code entry point, команды, sidebar |
| `src/NexusLoop.ts` | Wiring XState actor → UI |
| `src/core/NexusAgentFactory.ts` | DI сборка всех агентов |
| `src/core/llm/AnthropicGateway.ts` | LLM gateway (Claude) |
| `agents/run*.ts` | XState actor wrappers для каждого агента |
| `ui/webview.types.ts` | Extension↔Webview протокол |
| `CLAUDE.md` | Глобальные guidelines для AI-агентов |
| `ROADMAP.md` | Детальный phased plan развития |

---

## KPI проекта

- **Token Efficiency**: снижение контекста на 60–80% через скелеты
- **Success Rate**: ≥90% успешных Shadow Build с первого промпта
- **Safety**: 0 критических уязвимостей, пропущенных Reviewer

---

## Контакты и ресурсы

- **Репозиторий**: https://github.com/nexus-ai/nexus-agent-ide
- **Документация**: `docs/`, `README.md`, `README.ru.md`
- **Roadmap**: `ROADMAP.md`, `NEXUS_ROADMAP.md`
