import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { applyMd3Theme } from './applyTheme';
import { seedForRank, type RankKey } from './seeds';

export type ColorModeSetting = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  rank: RankKey | null;
  setRank(rank: RankKey | null): void;
  modeSetting: ColorModeSetting;
  setModeSetting(mode: ColorModeSetting): void;
  resolvedDark: boolean;
}

const STORAGE_KEY = 'mjsv:color-mode';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isColorModeSetting(value: unknown): value is ColorModeSetting {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredModeSetting(): ColorModeSetting {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isColorModeSetting(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider(props: { children: ReactNode }): ReactElement {
  const [rank, setRank] = useState<RankKey | null>(null);
  const [modeSetting, setModeSettingState] = useState<ColorModeSetting>(() => readStoredModeSetting());
  const [systemDark, setSystemDark] = useState<boolean>(() => prefersDark());

  const resolvedDark = modeSetting === 'system' ? systemDark : modeSetting === 'dark';

  const setModeSetting = useCallback((mode: ColorModeSetting) => {
    setModeSettingState(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // プライベートモード等で書き込み不可の場合は無視（system既定のまま）
    }
  }, []);

  // OS のダーク設定変更を常時購読し、system 設定時のみ反映する
  useLayoutEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  useLayoutEffect(() => {
    applyMd3Theme(seedForRank(rank), resolvedDark);
  }, [rank, resolvedDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      rank,
      setRank,
      modeSetting,
      setModeSetting,
      resolvedDark,
    }),
    [rank, modeSetting, setModeSetting, resolvedDark],
  );

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
