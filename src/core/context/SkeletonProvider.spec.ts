/**
 * SkeletonProvider — TDD Spec
 * Tests drive the implementation. Run before any implementation exists.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { skeletonize } from './skeleton-transformer.js';
import { SkeletonProvider } from './SkeletonProvider.js';

const HIDDEN = '{ /* implementation hidden */ }';

// ── skeleton-transformer unit tests ──────────────────────────────────────────

describe('skeleton-transformer: functions', () => {
  it('replaces function body with placeholder', () => {
    const src = `export function add(a: number, b: number): number { return a + b; }`;
    expect(skeletonize(src)).toContain(`add(a: number, b: number): number ${HIDDEN}`);
  });

  it('preserves the full function signature', () => {
    const src = `export async function fetchData<T>(url: string): Promise<T> { return fetch(url).json(); }`;
    const out = skeletonize(src);
    expect(out).toContain('async function fetchData<T>');
    expect(out).toContain('url: string): Promise<T>');
    expect(out).toContain(HIDDEN);
  });

  it('preserves JSDoc comments above functions', () => {
    const src = `
/** Adds two numbers. @param a first */
export function add(a: number, b: number): number { return a + b; }`;
    expect(skeletonize(src)).toContain('Adds two numbers');
    expect(skeletonize(src)).toContain(HIDDEN);
  });

  it('handles functions without return type annotation', () => {
    const src = `function greet(name: string) { console.log(name); }`;
    const out = skeletonize(src);
    expect(out).toContain('greet(name: string)');
    expect(out).toContain(HIDDEN);
    expect(out).not.toContain('console.log');
  });

  it('does not recurse into hidden function body', () => {
    const src = `function outer() { function inner() { return 42; } }`;
    const out = skeletonize(src);
    expect(out).not.toContain('function inner');
  });
});

describe('skeleton-transformer: arrow functions', () => {
  it('hides block body of const arrow function', () => {
    const src = `export const double = (n: number): number => { return n * 2; };`;
    const out = skeletonize(src);
    expect(out).toContain('double');
    expect(out).toContain(HIDDEN);
    expect(out).not.toContain('n * 2');
  });

  it('hides expression body of const arrow function', () => {
    const src = `export const double = (n: number): number => n * 2;`;
    const out = skeletonize(src);
    expect(out).toContain('double');
    expect(out).not.toContain('n * 2');
  });
});

describe('skeleton-transformer: classes', () => {
  it('hides method bodies but keeps signatures', () => {
    const src = `
export class Calculator {
  add(a: number, b: number): number { return a + b; }
}`;
    const out = skeletonize(src);
    expect(out).toContain('class Calculator');
    expect(out).toContain('add(a: number, b: number): number');
    expect(out).toContain(HIDDEN);
    expect(out).not.toContain('return a + b');
  });

  it('removes private members entirely', () => {
    const src = `
export class Vault {
  private secret = 42;
  private getSecret(): number { return this.secret; }
  public status(): string { return 'ok'; }
}`;
    const out = skeletonize(src);
    expect(out).not.toContain('secret');
    expect(out).not.toContain('getSecret');
    expect(out).toContain('status');
  });

  it('removes protected members by default', () => {
    const src = `class Base { protected helper(): void { } }`;
    expect(skeletonize(src)).not.toContain('helper');
  });

  it('includes private members when includePrivate: true', () => {
    const src = `class A { private x = 1; }`;
    expect(skeletonize(src, { includePrivate: true })).toContain('private x');
  });

  it('removes private identifier fields (#field)', () => {
    const src = `class A { #internal = 0; public id = 1; }`;
    const out = skeletonize(src);
    expect(out).not.toContain('#internal');
    expect(out).toContain('id');
  });

  it('hides constructor body', () => {
    const src = `class Service { constructor(private name: string) { this.init(); } }`;
    const out = skeletonize(src, { includePrivate: true });
    expect(out).toContain('constructor');
    expect(out).toContain(HIDDEN);
    expect(out).not.toContain('this.init');
  });

  it('keeps abstract method signatures (no body to hide)', () => {
    const src = `abstract class Shape { abstract area(): number; }`;
    const out = skeletonize(src);
    expect(out).toContain('abstract class Shape');
    expect(out).toContain('abstract area(): number');
  });

  it('handles decorators on classes', () => {
    const src = `@Injectable()\nexport class Service { run(): void { console.log('x'); } }`;
    const out = skeletonize(src);
    expect(out).toContain('@Injectable');
    expect(out).toContain('run(): void');
    expect(out).not.toContain("console.log");
  });
});

describe('skeleton-transformer: preserved nodes', () => {
  it('keeps import declarations unchanged', () => {
    const src = `import { Foo } from './foo.js';\nimport type { Bar } from './bar.js';`;
    const out = skeletonize(src);
    expect(out).toContain(`import { Foo } from './foo.js'`);
    expect(out).toContain(`import type { Bar } from './bar.js'`);
  });

  it('keeps interfaces fully intact', () => {
    const src = `export interface IUser { id: number; name: string; greet(): void; }`;
    const out = skeletonize(src);
    expect(out).toContain('interface IUser');
    expect(out).toContain('greet(): void');
  });

  it('keeps type aliases intact', () => {
    const src = `export type UserId = string & { readonly __brand: 'UserId' };`;
    expect(skeletonize(src)).toContain("type UserId = string & { readonly __brand: 'UserId' }");
  });

  it('keeps enum declarations intact', () => {
    const src = `export enum Color { Red = 'red', Blue = 'blue' }`;
    expect(skeletonize(src)).toContain("enum Color { Red = 'red', Blue = 'blue' }");
  });
});

// ── SkeletonProvider class tests ──────────────────────────────────────────────

describe('SkeletonProvider.fromContent', () => {
  let provider: SkeletonProvider;
  beforeEach(() => { provider = new SkeletonProvider(); });

  it('returns a SkeletonResult with all fields', () => {
    const result = provider.fromContent(`export function f(): void {}`, 'f.ts');
    expect(result.uri).toBe('f.ts');
    expect(result.skeleton).toBeTypeOf('string');
    expect(result.originalSize).toBeGreaterThan(0);
    expect(result.skeletonSize).toBeGreaterThan(0);
    expect(result.compressionRatio).toBeGreaterThan(0);
  });

  it('compressionRatio < 1 for implementation-heavy source', () => {
    const src = `
export function heavyFunction(a: number): string {
  const x = a * 1000;
  const y = x.toString();
  const z = y.split('').reverse().join('');
  return z;
}`;
    const result = provider.fromContent(src);
    expect(result.compressionRatio).toBeLessThan(1);
  });

  it('detects declarations correctly', () => {
    const src = `
import { X } from 'x';
export interface IFoo { bar: string; }
export function baz(): void {}
export class Qux {}`;
    const result = provider.fromContent(src);
    const kinds = result.declarations.map(d => d.kind);
    expect(kinds).toContain('import');
    expect(kinds).toContain('interface');
    expect(kinds).toContain('function');
    expect(kinds).toContain('class');
  });
});
