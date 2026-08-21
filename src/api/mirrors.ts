/**
 * データミラーの選択状態と localStorage 永続化（docs/design/issue-3-api-layer.md §5.1）。
 *
 * 本家は失敗時に全4ミラーへ同時 probe するが、リクエスト節度（CLAUDE.md）と衝突するため
 * 採用しない。ここでは「現在選んでいるミラー」を1本だけ保持し、client.ts が
 * ネットワーク層の失敗時のみ逐次フォールバックする。
 */

export const MIRRORS: readonly string[] = [
  'https://5-data.amae-koromo.com',
  'https://1.data.amae-koromo.com',
  'https://2.data.amae-koromo.com',
  'https://4.data.amae-koromo.com',
];

const STORAGE_KEY = 'mjsv:api-mirror';

let selectedMirrorIndex = 0;

function loadPersistedMirror(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const idx = MIRRORS.indexOf(stored);
      if (idx !== -1) {
        selectedMirrorIndex = idx;
      }
    }
  } catch {
    // localStorage 利用不可（プライベートモード・テスト環境）。メモリのみで動作する
  }
}
loadPersistedMirror();

export function getSelectedMirrorIndex(): number {
  return selectedMirrorIndex;
}

export function getSelectedMirror(): string {
  return MIRRORS[selectedMirrorIndex];
}

export function setSelectedMirrorIndex(index: number): void {
  selectedMirrorIndex = index;
  try {
    localStorage.setItem(STORAGE_KEY, MIRRORS[index]);
  } catch {
    // 同上。メモリの選択状態はすでに更新済みなので致命的ではない
  }
}
