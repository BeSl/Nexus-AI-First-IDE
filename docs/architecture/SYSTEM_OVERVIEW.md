# Nexus IDE: Архитектурная топология

Система строится на базе Code-OSS и состоит из 4-х изолированных слоёв.
Каждый слой имеет строгий интерфейс — прямые вызовы между слоями запрещены.

```
┌─────────────────────────────────────────────────────────────┐
│                    User / IDE Webview                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ intent (natural language)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Orchestrator  (XState machine)                  │
│                                                             │
│   idle → architect → [awaitingApproval] → coder             │
│                → reviewer → tester → done                   │
│                                                             │
│   core/orchestrator.machine.ts  ·  core/orchestrator.ts     │
└────────┬───────────────────────────────────┬────────────────┘
         │ IContextEngine.query()             │ IVirtualFileSystem
         ▼                                   ▼
┌─────────────────────┐          ┌──────────────────────────┐
│   Context Engine    │          │  VFS (Virtual File       │
│   (The Brain)       │          │  System)                 │
│                     │          │                          │
│ SkeletonProvider    │          │  staged changes sandbox  │
│  ↓ TypeScript AST   │          │  ~/.nexus/shadow-build/  │
│ keyword ranking     │          │  confirm() → real disk   │
│ token budget        │          │                          │
│                     │          │ BuildOrchestrator uses   │
│ src/core/context/   │          │ VFS to overlay changes   │
└─────────────────────┘          └──────────────────────────┘
         │
         ▼
┌─────────────────────┐
│   LSP Layer         │
│  (planned Phase 2)  │
│                     │
│  Language Server    │
│  AST → types +      │
│  import graph       │
└─────────────────────┘
```

## Правило взаимодействия

**Агенты НЕ читают файлы напрямую.** Все данные — только через `ContextEngine.query()`.

```typescript
// ✅ Правильно
const ctx = await contextEngine.query({
  intent: 'implement login flow',
  scope: ['src/auth'],
  maxTokens: 4000,
});
// ctx.skeletons — только сигнатуры, без тел функций

// ❌ Запрещено
const raw = fs.readFileSync('src/auth/service.ts'); // никогда
```

## Слой 1 — Context Engine (реализован)

**Файлы:** `src/core/context/`

| Компонент | Назначение |
|-----------|-----------|
| `SkeletonProvider` | TypeScript Compiler API → text splice → скелет без тел |
| `skeleton-transformer` | AST-guided замена тел, фильтрация private членов |
| `ContextEngine` | `index()` → `query()` с keyword ranking и token budget |

**Алгоритм `query()`:**
1. Фильтр по `scope` (substring match, Phase 2: glob)
2. Tokenize intent → keyword overlap score по каждому файлу
3. Greedy fill по `maxTokens` бюджету
4. Возврат `FileSkeleton[]` + `ragChunks: []` (Phase 2: embeddings)

**Сжатие:** `compressionRatio = skeletonSize / originalSize`.
Для типичного TypeScript файла — 0.2–0.4 (экономия 60–80% токенов).

## Слой 2 — Orchestrator (реализован)

**Файлы:** `core/orchestrator.machine.ts`, `core/orchestrator.ts`

XState машина с барьером `awaitingApproval` между Architect и Coder:
- Architect выдаёт только интерфейсы/схемы, никогда реализацию
- Пользователь видит blueprint **до** того, как пишется код
- Каждый агент инжектируется через `IAgentRunner` — машина не знает об LLM

## Слой 3 — VFS + BuildOrchestrator (реализован)

**Файлы:** `src/core/builder/`, `core/vfs.types.ts`

```
Agent write → VFS.write() → PendingChange (staged)
                                   ↓
BuildOrchestrator.runShadowBuild()
  → ShadowFS.prepare()     ← copy project + overlay VFS changes
  → BuildRunner.run()      ← execSync in shadow dir
  → ErrorAnalyzer.parse()  ← tsc/esbuild error parsing
  → ErrorAnalyzer.suggest() ← auto-fix for TS2307, TS7006, ...
  → ShadowFS.cleanup()     ← always, even on error
                                   ↓
           [User reviews BuildResult + SuggestedFix]
                                   ↓
                         VFS.confirm() → real disk
```

## Слой 4 — LSP Layer (запланирован)

Phase 2. Language Server Protocol для:
- Реального AST анализа (типы, ссылки, граф зависимостей)
- Замены keyword ranking на семантический поиск
- `go-to-definition` / `find-references` для агентов

## Code-OSS Base

```bash
# Версия
vscode@1.96.4  SHA: cd4ee3b1c348a13bafd8f9ad8060705f6d4b9cba

# Патчи (naming: NNNN-scope-description.patch)
patches/
  0001–0099  branding   # Remove MS telemetry, rebrand to Nexus
  0100–0199  nexus-core # Agent orchestration hooks
  0200–0299  nexus-ui   # Webview panels (ArchitectureGraph)
```

## Статус реализации

| Слой | Компонент | Тесты | Статус |
|------|-----------|-------|--------|
| Context | SkeletonProvider | 22/22 ✅ | реализован |
| Context | ContextEngine | 13/13 ✅ | реализован |
| Orchestrator | XState machine | 7/7 ✅ | реализован |
| Builder | BuildOrchestrator | 16/16 ✅ | реализован |
| Agents | ArchitectAgent | — | контракты готовы |
| LSP | Language Server | — | запланирован |
| UI | ArchitectureGraph | — | запланирован |
