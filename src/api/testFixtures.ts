/**
 * テスト専用フィクスチャ読み込みヘルパー。
 * resolveJsonModule を有効化せずに済むよう、ES import ではなく fs 経由で読む。
 * バレル（index.ts）からは公開しない。
 *
 * tsconfig.app.json の "types" は ["vite/client"] のみに絞られており node の
 * アンビエント型を含まないため、このファイルに限定して参照する（tsconfig 自体は変更しない）。
 */
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const testdataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'testdata');

export function loadFixture<T>(name: string): T {
  const raw = readFileSync(path.join(testdataDir, name), 'utf-8');
  return JSON.parse(raw) as T;
}

/** localStorage の最小モック（Node 実行環境には global localStorage が無いため） */
export class FakeStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

export function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}
