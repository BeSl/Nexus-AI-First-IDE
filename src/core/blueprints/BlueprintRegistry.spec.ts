/**
 * BlueprintRegistry — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { BlueprintRegistry } from './BlueprintRegistry.js';
import type { IBlueprint } from './blueprint.types.js';

function makeBlueprint(id: string, platform: IBlueprint['manifest']['platform'] = 'backend'): IBlueprint {
  return {
    manifest: { id, name: id, platform, description: 'test', tags: [] },
    scaffold: (vars) => [{ path: `src/${vars.name}.ts`, content: `// ${vars.name}` }],
  };
}

describe('BlueprintRegistry — built-ins', () => {
  it('loads 4 built-in blueprints', () => {
    const r = new BlueprintRegistry();
    expect(r.size).toBe(4);
  });

  it('includes node-backend', () => {
    const r = new BlueprintRegistry();
    expect(r.resolve('node-backend')).toBeDefined();
  });

  it('includes electron', () => {
    expect(new BlueprintRegistry().resolve('electron')).toBeDefined();
  });

  it('includes react-native', () => {
    expect(new BlueprintRegistry().resolve('react-native')).toBeDefined();
  });

  it('includes web-extension', () => {
    expect(new BlueprintRegistry().resolve('web-extension')).toBeDefined();
  });
});

describe('BlueprintRegistry.register', () => {
  it('adds a custom blueprint', () => {
    const r = new BlueprintRegistry();
    r.register(makeBlueprint('custom'));
    expect(r.resolve('custom')).toBeDefined();
    expect(r.size).toBe(5);
  });

  it('overwrites blueprint with same id', () => {
    const r = new BlueprintRegistry();
    r.register(makeBlueprint('node-backend', 'web'));
    expect(r.resolve('node-backend')?.manifest.platform).toBe('web');
  });

  it('throws on empty id', () => {
    const r = new BlueprintRegistry();
    expect(() => r.register(makeBlueprint(''))).toThrow();
  });
});

describe('BlueprintRegistry.listManifests', () => {
  it('lists all manifests', () => {
    const r = new BlueprintRegistry();
    const manifests = r.listManifests();
    expect(manifests.length).toBe(4);
    expect(manifests.map((m) => m.id)).toContain('electron');
  });
});

describe('Blueprint.scaffold — variable interpolation', () => {
  it('substitutes {{name}} in file paths', () => {
    const r = new BlueprintRegistry();
    const bp = r.resolve('node-backend')!;
    const files = bp.scaffold({ name: 'my-api', description: 'REST API' });
    const paths = files.map((f) => f.path);
    expect(paths).toContain('package.json');
    expect(paths).toContain('src/index.ts');
  });

  it('substitutes {{name}} in package.json content', () => {
    const r = new BlueprintRegistry();
    const files = r.resolve('node-backend')!.scaffold({ name: 'hero-api', description: 'Hero' });
    const pkg = files.find((f) => f.path === 'package.json')!;
    expect(pkg.content).toContain('"hero-api"');
  });

  it('substitutes {{author}} when provided', () => {
    const r = new BlueprintRegistry();
    const files = r.resolve('electron')!.scaffold({ name: 'myapp', author: 'Alice' });
    const main = files.find((f) => f.path === 'src/main.ts')!;
    expect(main.content).toContain('Alice');
  });

  it('react-native scaffold generates App.tsx', () => {
    const r = new BlueprintRegistry();
    const files = r.resolve('react-native')!.scaffold({ name: 'NexusMobile' });
    expect(files.map((f) => f.path)).toContain('src/App.tsx');
  });

  it('web-extension scaffold has extension.types.ts', () => {
    const r = new BlueprintRegistry();
    const files = r.resolve('web-extension')!.scaffold({ name: 'nexus-plugin', description: 'Nexus Plugin' });
    expect(files.map((f) => f.path)).toContain('src/extension.types.ts');
  });
});
