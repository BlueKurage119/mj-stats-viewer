/**
 * テスト専用ヘルパー（localStorage モック・fetch レスポンスモック）。
 * バレル（index.ts）からは公開しない。
 *
 * フィクスチャ本体（testdata/*.json）は各テストファイルから
 * `import raw from './testdata/xxx.json'` の形で直接 import する
 * （tsconfig.app.json の resolveJsonModule を使用。node 依存は無い）。
 */

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
