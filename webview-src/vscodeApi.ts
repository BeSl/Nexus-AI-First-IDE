/**
 * VS Code Webview API singleton.
 * acquireVsCodeApi() may be called exactly once per webview lifetime.
 * @security No secrets flow through this API — only control messages.
 */

export interface VscodeApi {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VscodeApi;

// Singleton — called once at module load time
export const vscodeApi: VscodeApi =
  typeof acquireVsCodeApi === 'function'
    ? acquireVsCodeApi()
    : { postMessage: () => {}, getState: () => null, setState: () => {} };
