// agents/runArchitect.ts
import { fromPromise } from 'xstate';
import { ARCHITECT_SYSTEM_PROMPT } from './prompts';
import { SkeletonProvider } from '../core/context/SkeletonProvider';
// Импортируй свой LLM gateway
import { AnthropicGateway } from '../core/llm/AnthropicGateway'; 

export const runArchitect = fromPromise(async ({ input }: { input: any }) => {
  const { intent, taskId } = input;
  
  const skeletonProvider = new SkeletonProvider();
  const llm = new AnthropicGateway();

  // 1. Получаем контекст проекта (скелеты)
  const projectContextMap = await skeletonProvider.fromDirectory('./src', { recursive: true });
  const contextSnapshot = Array.from(projectContextMap.values())
    .map(s => `File: ${s.uri}\n${s.skeleton}`)
    .join('\n\n');

  // 2. Формируем запрос
  const response = await llm.complete({
    system: ARCHITECT_SYSTEM_PROMPT,
    messages: [
      { 
        role: 'user', 
        content: `Project Context:\n${contextSnapshot}\n\nUser Intent: ${intent}` 
      }
    ],
    // Важно: просим LLM возвращать JSON
    response_format: { type: 'json_object' } 
  });

  // 3. Парсим результат
  try {
    const result = JSON.parse(response.content);
    
    // Возвращаем данные в формате AgentResult для XState
    return {
      taskId,
      role: 'architect',
      message: result.plan,
      artifacts: result.artifacts.map((a: any) => ({
        ...a,
        status: 'pending' // Все артефакты архитектора требуют апрува
      }))
    };
  } catch (error) {
    throw new Error(`Architect failed to generate valid JSON: ${error}`);
  }
});