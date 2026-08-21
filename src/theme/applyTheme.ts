import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
  type CustomColorGroup,
  type Theme,
} from '@material/material-color-utilities';
import { SECTION_COLORS, type SectionKey } from './seeds';

/**
 * `@material/material-color-utilities` 0.3.0 には `applyTheme()` が存在するが、
 * - customColors を一切書き出さない
 * - 旧 `Scheme` に `surfaceContainer*` 系トークンが無い
 * ため使用しない。トークンの CSS 変数書き出しは全て自前実装とする（設計書 §1・§3）。
 */

const sectionKeys = Object.keys(SECTION_COLORS) as SectionKey[];

const customColorDefs = sectionKeys.map((key) => ({
  value: argbFromHex(SECTION_COLORS[key]),
  name: key,
  blend: false,
}));

/** シードHEXごとにテーマ生成をメモ化する（取りうるシードは5種のみ） */
const themeCache = new Map<string, Theme>();

function themeForSeed(seed: string): Theme {
  let theme = themeCache.get(seed);
  if (!theme) {
    theme = themeFromSourceColor(argbFromHex(seed), customColorDefs);
    themeCache.set(seed, theme);
  }
  return theme;
}

/** camelCase → kebab-case（例: onPrimaryContainer → on-primary-container） */
function kebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function findCustomColorGroup(
  theme: Theme,
  name: SectionKey,
): CustomColorGroup {
  const group = theme.customColors.find((c) => c.color.name === name);
  if (!group) {
    throw new Error(`customColor group not found for "${name}"`);
  }
  return group;
}

/**
 * シードから light/dark 両スキーム＋セクション4色を生成し、
 * :root（document.documentElement）に CSS 変数として反映する。
 */
export function applyMd3Theme(seed: string, dark: boolean): void {
  const theme = themeForSeed(seed);
  const scheme = dark ? theme.schemes.dark : theme.schemes.light;
  const root = document.documentElement;

  // 1. scheme.toJSON() の29キーをすべて --md-sys-color-{kebab} で書き出す
  const schemeJson = scheme.toJSON();
  for (const [key, value] of Object.entries(schemeJson)) {
    root.style.setProperty(`--md-sys-color-${kebabCase(key)}`, hexFromArgb(value));
  }

  // 2. neutral palette から surface-container 系8トークンを M3 現行仕様のトーンで合成する
  const neutral = theme.palettes.neutral;
  const primaryArgb = schemeJson.primary;
  const surfaceContainerTones = dark
    ? {
        surfaceDim: 6,
        surfaceBright: 24,
        surfaceContainerLowest: 4,
        surfaceContainerLow: 10,
        surfaceContainer: 12,
        surfaceContainerHigh: 17,
        surfaceContainerHighest: 22,
      }
    : {
        surfaceDim: 87,
        surfaceBright: 98,
        surfaceContainerLowest: 100,
        surfaceContainerLow: 96,
        surfaceContainer: 94,
        surfaceContainerHigh: 92,
        surfaceContainerHighest: 90,
      };

  root.style.setProperty('--md-sys-color-surface-dim', hexFromArgb(neutral.tone(surfaceContainerTones.surfaceDim)));
  root.style.setProperty('--md-sys-color-surface-bright', hexFromArgb(neutral.tone(surfaceContainerTones.surfaceBright)));
  root.style.setProperty(
    '--md-sys-color-surface-container-lowest',
    hexFromArgb(neutral.tone(surfaceContainerTones.surfaceContainerLowest)),
  );
  root.style.setProperty(
    '--md-sys-color-surface-container-low',
    hexFromArgb(neutral.tone(surfaceContainerTones.surfaceContainerLow)),
  );
  root.style.setProperty('--md-sys-color-surface-container', hexFromArgb(neutral.tone(surfaceContainerTones.surfaceContainer)));
  root.style.setProperty(
    '--md-sys-color-surface-container-high',
    hexFromArgb(neutral.tone(surfaceContainerTones.surfaceContainerHigh)),
  );
  root.style.setProperty(
    '--md-sys-color-surface-container-highest',
    hexFromArgb(neutral.tone(surfaceContainerTones.surfaceContainerHighest)),
  );
  root.style.setProperty('--md-sys-color-surface-tint', hexFromArgb(primaryArgb));

  // 3. surface/background を現行仕様のトーンで上書きする（29キー書き出しの後勝ち）
  const surfaceTone = dark ? 6 : 98;
  const surfaceHex = hexFromArgb(neutral.tone(surfaceTone));
  root.style.setProperty('--md-sys-color-surface', surfaceHex);
  root.style.setProperty('--md-sys-color-background', surfaceHex);

  // customColors → --md-custom-color-*
  for (const key of sectionKeys) {
    const group = findCustomColorGroup(theme, key);
    const roles = dark ? group.dark : group.light;
    root.style.setProperty(`--md-custom-color-${key}`, hexFromArgb(roles.color));
    root.style.setProperty(`--md-custom-color-on-${key}`, hexFromArgb(roles.onColor));
    root.style.setProperty(`--md-custom-color-${key}-container`, hexFromArgb(roles.colorContainer));
    root.style.setProperty(`--md-custom-color-on-${key}-container`, hexFromArgb(roles.onColorContainer));
  }

  // ネイティブUI・スクロールバーの追従と FOUC 対策スクリプトとの整合
  root.style.colorScheme = dark ? 'dark' : 'light';
}
