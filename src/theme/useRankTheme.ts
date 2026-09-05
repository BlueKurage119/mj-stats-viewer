import { useEffect } from 'react';
import { useTheme } from './ThemeProvider';
import { rankFromLevelId } from './seeds';

/**
 * levelId に対応する段位シードへテーマを切り替える。
 * `levelId === null`（loading / notFound / error）のときは何もせず直前のシードを維持する。
 * アンマウントで既定シードへ戻す（検索画面へ戻る等）。
 * 詳細: docs/design/issue-8-identity-card.md §3.4
 */
export function useRankTheme(levelId: number | null): void {
  const { setRank } = useTheme();

  useEffect(() => {
    if (levelId === null) return;
    setRank(rankFromLevelId(levelId));
  }, [levelId, setRank]);

  useEffect(() => {
    return () => setRank(null);
  }, [setRank]);
}
