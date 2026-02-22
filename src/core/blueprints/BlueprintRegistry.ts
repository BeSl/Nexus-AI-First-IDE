/**
 * BlueprintRegistry — Project Template Manager
 *
 * Stores built-in and user-registered blueprints.
 * Used by the Architect agent and CLI scaffolding commands.
 *
 * Built-in blueprints:
 *   - node-backend   : Node.js + Express + AgentTS
 *   - electron       : Electron Desktop IDE shell
 *   - react-native   : React Native mobile app
 *   - web-extension  : VS Code Extension (Nexus plugin)
 *
 * @security Variable interpolation uses allowlist substitution — no eval.
 */

import type { IBlueprint, BlueprintManifest, BlueprintVariables, BlueprintFile } from './blueprint.types.js';

export class BlueprintRegistry {
  readonly #store = new Map<string, IBlueprint>();

  constructor() {
    for (const bp of BUILT_IN_BLUEPRINTS) this.#store.set(bp.manifest.id, bp);
  }

  register(bp: IBlueprint): void {
    if (!bp.manifest.id) throw new Error('Blueprint id must be non-empty.');
    this.#store.set(bp.manifest.id, bp);
  }

  resolve(id: string): IBlueprint | undefined { return this.#store.get(id); }
  listManifests(): readonly BlueprintManifest[] {
    return [...this.#store.values()].map((b) => b.manifest);
  }
  get size(): number { return this.#store.size; }
}

// ── Template helper ───────────────────────────────────────────────────────────

function tpl(content: string, vars: BlueprintVariables): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? key);
}

function makeBlueprint(manifest: BlueprintManifest, files: BlueprintFile[]): IBlueprint {
  return {
    manifest,
    scaffold: (vars) => files.map((f) => ({ path: tpl(f.path, vars), content: tpl(f.content, vars) })),
  };
}

// ── Built-in blueprints ───────────────────────────────────────────────────────

const BUILT_IN_BLUEPRINTS: IBlueprint[] = [

  makeBlueprint(
    { id: 'node-backend', name: 'Node.js Backend', platform: 'backend',
      description: 'Express + TypeScript + AgentTS backend service',
      tags: ['node', 'express', 'backend', 'api'] },
    [
      { path: 'package.json', content: `{\n  "name": "{{name}}",\n  "version": "0.1.0",\n  "description": "{{description}}",\n  "type": "module",\n  "scripts": { "dev": "tsx watch src/index.ts", "test": "vitest run" },\n  "dependencies": { "express": "^4.18.0" },\n  "devDependencies": { "typescript": "^5.0.0", "vitest": "^1.0.0", "tsx": "^4.0.0" }\n}` },
      { path: 'src/index.ts', content: `/** {{name}} — entry point\n * @author {{author}}\n */\nimport express from 'express';\nconst app = express();\napp.use(express.json());\napp.get('/health', (_req, res) => res.json({ ok: true }));\napp.listen(3000, () => console.info('{{name}} running on :3000'));` },
      { path: 'src/index.types.ts', content: `/** {{name}} — HTTP API contracts */\nexport interface HealthResponse { readonly ok: boolean; }` },
      { path: 'tsconfig.json', content: `{\n  "compilerOptions": {\n    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",\n    "strict": true, "outDir": "dist", "rootDir": "src"\n  }\n}` },
    ],
  ),

  makeBlueprint(
    { id: 'electron', name: 'Electron Desktop', platform: 'desktop',
      description: 'Electron + TypeScript app shell for Nexus IDE',
      tags: ['electron', 'desktop', 'ide', 'vscode'] },
    [
      { path: 'package.json', content: `{\n  "name": "{{name}}",\n  "version": "0.1.0",\n  "main": "dist/main.js",\n  "scripts": { "start": "electron .", "build": "tsc", "test": "vitest run" },\n  "dependencies": { "electron": "^28.0.0" },\n  "devDependencies": { "typescript": "^5.0.0", "vitest": "^1.0.0" }\n}` },
      { path: 'src/main.ts', content: `/** {{name}} — Electron main process\n * @author {{author}}\n */\nimport { app, BrowserWindow } from 'electron';\nfunction createWindow() {\n  const win = new BrowserWindow({ width: 1280, height: 800, webPreferences: { nodeIntegration: false } });\n  win.loadFile('index.html');\n}\napp.whenReady().then(createWindow);` },
      { path: 'src/main.types.ts', content: `/** {{name}} — Electron IPC contracts */\nexport interface AppConfig { readonly name: string; readonly version: string; }` },
    ],
  ),

  makeBlueprint(
    { id: 'react-native', name: 'React Native Mobile', platform: 'mobile',
      description: 'React Native + TypeScript mobile app blueprint',
      tags: ['react-native', 'mobile', 'ios', 'android'] },
    [
      { path: 'package.json', content: `{\n  "name": "{{name}}",\n  "version": "0.1.0",\n  "scripts": { "start": "react-native start", "test": "jest" },\n  "dependencies": { "react": "18.2.0", "react-native": "0.73.0" },\n  "devDependencies": { "typescript": "^5.0.0", "@types/react": "^18.0.0" }\n}` },
      { path: 'src/App.tsx', content: `/** {{name}} — Root component\n * @author {{author}}\n */\nimport React from 'react';\nimport { View, Text, StyleSheet } from 'react-native';\nexport default function App() {\n  return <View style={s.root}><Text>{{name}}</Text></View>;\n}\nconst s = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center' } });` },
      { path: 'src/App.types.ts', content: `/** {{name}} — React Native screen contracts */\nexport interface ScreenProps { readonly title: string; }` },
    ],
  ),

  makeBlueprint(
    { id: 'web-extension', name: 'VS Code Extension', platform: 'web',
      description: 'VS Code Extension / Nexus Plugin blueprint',
      tags: ['vscode', 'extension', 'plugin', 'nexus'] },
    [
      { path: 'package.json', content: `{\n  "name": "{{name}}",\n  "displayName": "{{name}}",\n  "version": "0.1.0",\n  "engines": { "vscode": "^1.96.0" },\n  "activationEvents": [],\n  "main": "./dist/extension.js",\n  "scripts": { "compile": "tsc -p ./", "test": "vitest run" },\n  "devDependencies": { "@types/vscode": "^1.96.0", "typescript": "^5.0.0", "vitest": "^1.0.0" }\n}` },
      { path: 'src/extension.ts', content: `/** {{name}} — VS Code extension entry\n * @author {{author}}\n * @security Activates on demand — no ambient permissions.\n */\nimport * as vscode from 'vscode';\nexport function activate(ctx: vscode.ExtensionContext): void {\n  ctx.subscriptions.push(\n    vscode.commands.registerCommand('{{name}}.hello', () =>\n      vscode.window.showInformationMessage('{{description}}')\n    )\n  );\n}\nexport function deactivate(): void {}` },
      { path: 'src/extension.types.ts', content: `/** {{name}} — Extension command contracts */\nexport interface CommandPayload { readonly command: string; readonly args?: readonly unknown[]; }` },
    ],
  ),
];
