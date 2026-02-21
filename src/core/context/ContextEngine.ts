import { IContextManager, CodeSnippet, FileSkeleton } from './types';

/**
 * @implementation_guide
 * 1. Используйте 'tree-sitter' или встроенный в VS Code API для парсинга AST.
 * 2. Для формирования FileSkeleton удаляйте тела функций (всё, что внутри {}).
 * 3. Реализуйте алгоритм "Ranking": приоритет отдается файлам, которые открыты в редакторе
 * и тем, которые импортируют текущий редактируемый файл.
 */
export class ContextEngine implements IContextManager {
  // Агент должен реализовать методы здесь
  async getProjectMap(): Promise<FileSkeleton[]> {
    throw new Error("Not implemented. Agent, build the skeleton generator first.");
  }

  async getRelevantContext(prompt: string): Promise<CodeSnippet[]> {
     throw new Error("Not implemented. Use semantic search logic.");
  }

  pruneContext(tokens: number): void {
     // Реализовать FIFO (First In First Out) для старых фрагментов контекста
  }
}