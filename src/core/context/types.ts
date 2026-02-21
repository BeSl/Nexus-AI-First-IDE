/**
 * Описание фрагмента кода для контекста ИИ
 */
export interface CodeSnippet {
  filePath: string;
  content: string; // Только значимый код (без тел неважных функций)
  dependencies: string[]; // Пути к импортируемым файлам
  relevanceScore: number; // Насколько этот кусок важен для текущего промпта
}

/**
 * Скелет файла (File Outline)
 * Используется для экономии токенов
 */
export interface FileSkeleton {
  path: string;
  imports: string[];
  exportedSignatures: string[]; // Только названия функций, классов и их типы
}

export interface IContextManager {
  getProjectMap(): Promise<FileSkeleton[]>;
  getRelevantContext(prompt: string): Promise<CodeSnippet[]>;
  pruneContext(tokens: number): void; // Удаление лишнего при превышении лимита
}