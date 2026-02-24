# 🚀 Nexus IDE: Google Gemini Integration Standards

**CRITICAL CONTEXT:** We are integrating the `GeminiGateway` into the Nexus provider chain. The integration must be robust, handle JSON-mode reliably, and align with our existing `ILLMGateway` interface and `GatewayFactory` pattern.

When implementing or refactoring the Gemini integration, you MUST follow these technical requirements:

## 1. Gateway Implementation (Gemini AI SDK)
* **Client Initialization:** Use `@google/generative-ai` SDK. The `GeminiGateway` must accept an `apiKey` and a `defaultModel` (typically `gemini-2.0-flash`).
* **System Instructions:** Unlike OpenAI/Anthropic, Gemini requires the system prompt to be passed during model initialization via `systemInstruction`, NOT as a message in the history.
* **Role Mapping:** Correctly map Nexus roles to Gemini roles:
    - `system` -> Extract to `systemInstruction`.
    - `assistant` -> `model`.
    - `user` -> `user`.

## 2. Deterministic JSON Output
* **Response Constraints:** All agents (Architect, Coder, etc.) require valid JSON. 
* **Model Configuration:** When a task requires structured data, use `generationConfig: { responseMimeType: "application/json" }` to force the model to output valid JSON.
* **Validation:** Wrap the `complete()` call in a try-catch block. If the JSON is malformed, the gateway should provide a clean error message that the Orchestrator can use for its retry logic.

## 3. Context Efficiency & Token Tracking
* **Skeleton Integration:** Ensure `SkeletonProvider` outputs are passed correctly to Gemini to maintain context efficiency.
* **Telemetry:** Every request through `GeminiGateway` must report usage (promptTokens, completionTokens) to the `TelemetryService` for cost and performance tracking.

## 4. Configuration & Security
* **Settings Access:** Use `NexusConfig.readGatewayOptions()` to retrieve the Gemini API key and model name from VS Code settings (`nexus.llm.gemini.apiKey`).
* **Safety Settings:** Configure `HarmBlockThreshold` to `BLOCK_NONE` or `BLOCK_ONLY_HIGH` for coding tasks to prevent the model from refusing to generate valid architectural or security-related code.