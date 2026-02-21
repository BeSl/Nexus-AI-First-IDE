# Context Layer — Детальная документация

## Зачем это нужно

LLM-агенты потребляют токены. Если агент читает файл целиком (500 строк реализации),
тратится ~2000 токенов на код, который ему не нужен — только сигнатуры.

SkeletonProvider + ContextEngine решают это системно:
агент **никогда** не видит реализацию, пока явно не запросит конкретную строку.

```
Реальный файл (500 строк, ~2000 токенов)
          ↓  SkeletonProvider
Скелет    (80 строк, ~320 токенов)   ← compression ratio ≈ 0.16
```

## SkeletonProvider

**Файл:** `src/core/context/SkeletonProvider.ts`
**Ядро:** `src/core/context/skeleton-transformer.ts`

### Стратегия: text splice по позициям AST

Вместо того чтобы re-print AST (теряются комментарии), используем:
1. `ts.createSourceFile()` → получаем AST с позициями
2. Собираем `Replacement[]` — замены `{ start, end, text }`
3. Применяем в обратном порядке → исходный текст сохранён, только тела заменены

```typescript
// Исходник
export class AuthService {
  /** Authenticates user and returns JWT */
  public login(user: string, pass: string): Promise<string> {
    const hash = bcrypt.hash(pass);          // скрыто
    return this.db.findUser(user, hash);     // скрыто
  }
  private #cache = new Map<string, string>(); // удалено (private)
}

// Скелет
export class AuthService {
  /** Authenticates user and returns JWT */  ← JSDoc сохранён
  public login(user: string, pass: string): Promise<string> { /* implementation hidden */ }
                                              ← тело скрыто
  // #cache — удалено полностью
}
```

### Что обрабатывается

| Конструкция | Поведение |
|-------------|-----------|
| `function foo() { ... }` | тело → `{ /* implementation hidden */ }` |
| `const foo = () => expr` | expr → `{ /* implementation hidden */ }` |
| `const foo = () => { ... }` | тело → `{ /* implementation hidden */ }` |
| `class { public method() { ... } }` | тело скрыто |
| `class { private field }` | удалён полностью |
| `class { protected method() { } }` | удалён полностью |
| `class { #privateField }` | удалён полностью |
| `abstract method(): void;` | сохранён как есть (нет тела) |
| `interface { ... }` | сохранён полностью |
| `type Foo = ...` | сохранён полностью |
| `import { ... }` | сохранён полностью |
| `enum Color { ... }` | сохранён полностью |
| JSDoc `/** ... */` | сохранён (текст не трогается выше тела) |
| Декораторы `@Injectable()` | сохранены |

### API

```typescript
const provider = new SkeletonProvider();

// Из строки (быстро, для агентов)
const result = provider.fromContent(source, 'auth.ts');
// result.skeleton      — трансформированный TypeScript
// result.compressionRatio — skeletonSize / originalSize
// result.declarations  — [{ kind, name, exported }]

// Из файла
const result = await provider.fromFile('/path/to/file.ts');

// Из директории
const map = await provider.fromDirectory('/src', { recursive: true });
// map: Map<string, SkeletonResult>
```

## ContextEngine

**Файл:** `src/core/context/ContextEngine.ts`

Реализует `IContextEngine` из `core/context-engine.types.ts`.

### Жизненный цикл

```typescript
const engine = new ContextEngine(fileReader);

// 1. Индексировать файлы (при старте или при изменении)
await engine.index(['src/auth/service.ts', 'src/db/repository.ts']);

// 2. Агент запрашивает контекст
const ctx = await engine.query({
  intent: 'implement login with JWT',
  scope: ['src/auth'],          // ограничение по директории
  maxTokens: 4000,              // бюджет токенов
  topK: 5,                      // не более 5 файлов
});
// ctx.skeletons — отсортированные по релевантности FileSkeleton[]
// ctx.totalTokens — фактически потрачено токенов
// ctx.ragChunks  — [] (Phase 2: real embeddings)

// 3. При изменении файла — инвалидировать кэш
engine.invalidate(['src/auth/service.ts']);
```

### Алгоритм `query()` (Phase 1)

```
1. Scope filter
   uris = index.keys()
   if scope → filter(uri → scope.some(p → uri.includes(p)))

2. Keyword ranking
   keywords = tokenize(intent)   // lowercase word tokens
   score(uri) = |keywords ∩ words(skeleton(uri))|
   sort by score DESC, take topK

3. Token budget
   spent = 0
   for uri in ranked:
     cost = ceil(skeletonSize / 4)   // ~4 chars/token
     if spent + cost > maxTokens: break
     add to result
     spent += cost
```

### IFileReader (инъекция)

`ContextEngine` не импортирует `fs` — читает файлы через инжектируемый интерфейс:

```typescript
export interface IFileReader {
  read(uri: string): Promise<string>;
}

// В тестах — in-memory mock
const reader = { read: async (uri) => fileMap[uri] };

// В production — реальный FS
const reader = { read: async (uri) => fs.promises.readFile(uri, 'utf-8') };

// Через VFS (для staged изменений)
const reader = { read: async (uri) => vfs.read(uri, taskId) };
```

### Phase 2: Vector Embeddings (TODO)

Для Phase 2 заменить `overlap()` на cosine similarity:

```typescript
// Текущий Phase 1
function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0; for (const w of a) if (b.has(w)) n++; return n;
}

// Phase 2 (TODO): вызов Anthropic Embeddings API
async function cosine(intentEmbedding: number[], fileEmbedding: number[]): number {
  // dot product / (|a| * |b|)
}
```

Интерфейс `VectorChunk` уже готов в `core/context-engine.types.ts` — структура не изменится.

## Правило для агентов

Добавить в `CLAUDE.md` / системный промпт агента:

```
Перед тем как запросить содержимое любого файла:
1. Вызови ContextEngine.query({ intent, scope, maxTokens: 3000 })
2. Работай со skeleton — это сигнатуры без реализации
3. Полный текст файла запрашивай только если нужно изменить конкретную строку
4. Это правило нельзя обойти — прямой fs.readFile запрещён
```
