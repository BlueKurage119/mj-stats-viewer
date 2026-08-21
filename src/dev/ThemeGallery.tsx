import { useEffect, useState, type ReactElement } from 'react';
import { useTheme, type ColorModeSetting } from '../theme/ThemeProvider';
import { SECTION_COLORS, type RankKey, type SectionKey } from '../theme/seeds';

/**
 * dev 専用の `/__theme` 確認ページ。
 * 本番ビルドでは main.tsx の `import.meta.env.DEV` 分岐により到達不能・emit されない。
 */

const RANK_OPTIONS: { value: RankKey | null; label: string }[] = [
  { value: null, label: '既定（緑）' },
  { value: 'ketsu', label: '雀傑（金）' },
  { value: 'gou', label: '雀豪（橙）' },
  { value: 'sei', label: '雀聖（赤）' },
  { value: 'konten', label: '魂天（青）' },
];

const MODE_OPTIONS: ColorModeSetting[] = ['light', 'dark', 'system'];

/** scheme.toJSON() の29キー（kebab-case）。書き出し順は applyTheme.ts と合わせる必要はない（表示専用）。 */
const SCHEME_TOKENS = [
  'primary',
  'on-primary',
  'primary-container',
  'on-primary-container',
  'secondary',
  'on-secondary',
  'secondary-container',
  'on-secondary-container',
  'tertiary',
  'on-tertiary',
  'tertiary-container',
  'on-tertiary-container',
  'error',
  'on-error',
  'error-container',
  'on-error-container',
  'background',
  'on-background',
  'surface',
  'on-surface',
  'surface-variant',
  'on-surface-variant',
  'outline',
  'outline-variant',
  'shadow',
  'scrim',
  'inverse-surface',
  'inverse-on-surface',
  'inverse-primary',
  // 合成8トークン（設計書 §3.1）
  'surface-dim',
  'surface-bright',
  'surface-container-lowest',
  'surface-container-low',
  'surface-container',
  'surface-container-high',
  'surface-container-highest',
  'surface-tint',
] as const;

/** スウォッチのラベル文字に使う「対になる on 色」。自然な対がないトークンは on-surface にフォールバック */
const ON_PAIR: Record<string, string> = {
  primary: 'on-primary',
  'on-primary': 'primary',
  'primary-container': 'on-primary-container',
  'on-primary-container': 'primary-container',
  secondary: 'on-secondary',
  'on-secondary': 'secondary',
  'secondary-container': 'on-secondary-container',
  'on-secondary-container': 'secondary-container',
  tertiary: 'on-tertiary',
  'on-tertiary': 'tertiary',
  'tertiary-container': 'on-tertiary-container',
  'on-tertiary-container': 'tertiary-container',
  error: 'on-error',
  'on-error': 'error',
  'error-container': 'on-error-container',
  'on-error-container': 'error-container',
  background: 'on-background',
  'on-background': 'background',
  surface: 'on-surface',
  'on-surface': 'surface',
  'surface-variant': 'on-surface-variant',
  'on-surface-variant': 'surface-variant',
  'inverse-surface': 'inverse-on-surface',
  'inverse-on-surface': 'inverse-surface',
  'inverse-primary': 'on-primary',
};

const SECTION_KEYS = Object.keys(SECTION_COLORS) as SectionKey[];
const SECTION_LABELS: Record<SectionKey, string> = {
  win: '和了',
  dealin: '放銃',
  riichi: '立直',
  luck: '運',
};

const TYPESCALE_SIZES = ['large', 'medium', 'small'] as const;
const TYPESCALE_CATEGORIES = ['display', 'headline', 'title', 'body', 'label'] as const;

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}

// --- WCAG コントラスト比計算（dev専用の素朴な実装） ---

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

interface ContrastCheck {
  label: string;
  foreground: string;
  background: string;
  minRatio: number;
}

function Swatch({ token, tick }: { token: string; tick: number }): ReactElement {
  const onToken = ON_PAIR[token] ?? 'on-surface';
  const [bg, setBg] = useState('');
  const [fg, setFg] = useState('');

  useEffect(() => {
    setBg(readCssVar(`md-sys-color-${token}`));
    setFg(readCssVar(`md-sys-color-${onToken}`));
    // tick は段位・モード変更ごとの再測定トリガー
  }, [token, onToken, tick]);

  return (
    <div
      style={{
        background: bg || 'transparent',
        color: fg || 'inherit',
        border: '1px solid var(--md-sys-color-outline-variant)',
        borderRadius: 8,
        padding: '10px 12px',
        minWidth: 180,
      }}
    >
      <div className="md-typescale-label-medium">--md-sys-color-{token}</div>
      <div className="md-typescale-body-small numeric">{bg}</div>
    </div>
  );
}

function SectionSwatch({ section, tick }: { section: SectionKey; tick: number }): ReactElement {
  const [values, setValues] = useState({ color: '', on: '', container: '', onContainer: '' });

  useEffect(() => {
    setValues({
      color: readCssVar(`md-custom-color-${section}`),
      on: readCssVar(`md-custom-color-on-${section}`),
      container: readCssVar(`md-custom-color-${section}-container`),
      onContainer: readCssVar(`md-custom-color-on-${section}-container`),
    });
  }, [section, tick]);

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <div
        style={{
          background: values.color,
          color: values.on,
          borderRadius: 8,
          padding: '10px 12px',
          minWidth: 160,
        }}
      >
        <div className="md-typescale-label-medium">
          {SECTION_LABELS[section]} / --md-custom-color-{section}
        </div>
        <div className="md-typescale-body-small numeric">{values.color}</div>
      </div>
      <div
        style={{
          background: values.container,
          color: values.onContainer,
          borderRadius: 8,
          padding: '10px 12px',
          minWidth: 160,
        }}
      >
        <div className="md-typescale-label-medium">{section}-container</div>
        <div className="md-typescale-body-small numeric">{values.container}</div>
      </div>
    </div>
  );
}

function ContrastRow({ check, tick }: { check: ContrastCheck; tick: number }): ReactElement {
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    const fg = readCssVar(`md-sys-color-${check.foreground}`) || readCssVar(`md-custom-color-${check.foreground}`);
    const bg = readCssVar(`md-sys-color-${check.background}`) || readCssVar(`md-custom-color-${check.background}`);
    if (fg && bg) {
      setRatio(contrastRatio(fg, bg));
    } else {
      setRatio(null);
    }
    // tick は再測定トリガー
  }, [check, tick]);

  const pass = ratio !== null && ratio >= check.minRatio;

  return (
    <tr>
      <td className="md-typescale-body-small">{check.label}</td>
      <td className="md-typescale-body-small numeric">{ratio !== null ? ratio.toFixed(2) : '-'}</td>
      <td className="md-typescale-body-small numeric">{check.minRatio.toFixed(1)}</td>
      <td
        className="md-typescale-label-medium"
        style={{ color: pass ? 'var(--md-sys-color-tertiary)' : 'var(--md-sys-color-error)' }}
      >
        {pass ? 'OK' : '警告'}
      </td>
    </tr>
  );
}

function buildContrastChecks(): ContrastCheck[] {
  const pairChecks: ContrastCheck[] = [
    { label: 'onPrimary on primary', foreground: 'on-primary', background: 'primary', minRatio: 4.5 },
    {
      label: 'onPrimaryContainer on primaryContainer',
      foreground: 'on-primary-container',
      background: 'primary-container',
      minRatio: 4.5,
    },
    { label: 'onSecondary on secondary', foreground: 'on-secondary', background: 'secondary', minRatio: 4.5 },
    {
      label: 'onSecondaryContainer on secondaryContainer',
      foreground: 'on-secondary-container',
      background: 'secondary-container',
      minRatio: 4.5,
    },
    { label: 'onTertiary on tertiary', foreground: 'on-tertiary', background: 'tertiary', minRatio: 4.5 },
    {
      label: 'onTertiaryContainer on tertiaryContainer',
      foreground: 'on-tertiary-container',
      background: 'tertiary-container',
      minRatio: 4.5,
    },
    { label: 'onError on error', foreground: 'on-error', background: 'error', minRatio: 4.5 },
    {
      label: 'onErrorContainer on errorContainer',
      foreground: 'on-error-container',
      background: 'error-container',
      minRatio: 4.5,
    },
    { label: 'onBackground on background', foreground: 'on-background', background: 'background', minRatio: 4.5 },
    { label: 'onSurface on surface', foreground: 'on-surface', background: 'surface', minRatio: 4.5 },
    {
      label: 'onSurfaceVariant on surfaceVariant',
      foreground: 'on-surface-variant',
      background: 'surface-variant',
      minRatio: 4.5,
    },
    {
      label: 'inverseOnSurface on inverseSurface',
      foreground: 'inverse-on-surface',
      background: 'inverse-surface',
      minRatio: 4.5,
    },
  ];

  const largeChecks: ContrastCheck[] = [
    { label: 'primary on surface（大型/図形）', foreground: 'primary', background: 'surface', minRatio: 3.0 },
    { label: 'secondary on surface（大型/図形）', foreground: 'secondary', background: 'surface', minRatio: 3.0 },
    { label: 'tertiary on surface（大型/図形）', foreground: 'tertiary', background: 'surface', minRatio: 3.0 },
    { label: 'error on surface（大型/図形）', foreground: 'error', background: 'surface', minRatio: 3.0 },
  ];

  const sectionChecks: ContrastCheck[] = SECTION_KEYS.flatMap((key) => [
    { label: `on-${key} on ${key}`, foreground: `on-${key}`, background: key, minRatio: 4.5 },
    {
      label: `on-${key}-container on ${key}-container`,
      foreground: `on-${key}-container`,
      background: `${key}-container`,
      minRatio: 4.5,
    },
    { label: `${key} on surface（大型/図形）`, foreground: key, background: 'surface', minRatio: 3.0 },
  ]);

  return [...pairChecks, ...largeChecks, ...sectionChecks];
}

const CONTRAST_CHECKS = buildContrastChecks();

export function ThemeGallery(): ReactElement {
  const { rank, setRank, modeSetting, setModeSetting, resolvedDark } = useTheme();
  const [tick, setTick] = useState(0);

  // 段位・モード変更のたびにスウォッチ実測値を再取得させるためのトリガー
  useEffect(() => {
    setTick((t) => t + 1);
  }, [rank, resolvedDark]);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
      <h1 className="md-typescale-headline-medium">/__theme — MD3テーマ確認ページ（dev限定）</h1>

      <section style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <h2 className="md-typescale-title-medium">段位</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {RANK_OPTIONS.map((opt) => (
              <label key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="radio"
                  name="rank"
                  checked={rank === opt.value}
                  onChange={() => setRank(opt.value)}
                />
                <span className="md-typescale-body-medium">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h2 className="md-typescale-title-medium">カラーモード</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MODE_OPTIONS.map((mode) => (
              <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="radio"
                  name="mode"
                  checked={modeSetting === mode}
                  onChange={() => setModeSetting(mode)}
                />
                <span className="md-typescale-body-medium">{mode}</span>
              </label>
            ))}
          </div>
          <p className="md-typescale-body-small">実効値: {resolvedDark ? 'dark' : 'light'}</p>
        </div>
      </section>

      <section>
        <h2 className="md-typescale-title-medium">スキームスウォッチ（--md-sys-color-* 全37）</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SCHEME_TOKENS.map((token) => (
            <Swatch key={token} token={token} tick={tick} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="md-typescale-title-medium">セクションスウォッチ（--md-custom-color-* 16）</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SECTION_KEYS.map((key) => (
            <SectionSwatch key={key} section={key} tick={tick} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="md-typescale-title-medium">コントラスト確認</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th className="md-typescale-label-medium" style={{ textAlign: 'left' }}>
                ペア
              </th>
              <th className="md-typescale-label-medium" style={{ textAlign: 'left' }}>
                実測比
              </th>
              <th className="md-typescale-label-medium" style={{ textAlign: 'left' }}>
                基準
              </th>
              <th className="md-typescale-label-medium" style={{ textAlign: 'left' }}>
                判定
              </th>
            </tr>
          </thead>
          <tbody>
            {CONTRAST_CHECKS.map((check) => (
              <ContrastRow key={check.label} check={check} tick={tick} />
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="md-typescale-title-medium">typescale 見本</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TYPESCALE_CATEGORIES.flatMap((category) =>
            TYPESCALE_SIZES.map((size) => (
              <div key={`${category}-${size}`} className={`md-typescale-${category}-${size}`}>
                {category}-{size}: 雀傑★★ <span className="numeric">232/1400</span>
              </div>
            )),
          )}
          <div className="md-typescale-label-large-prominent">
            label-large-prominent: 雀傑★★ <span className="numeric">232/1400</span>
          </div>
          <div className="md-typescale-body-medium-prominent">
            body-medium-prominent: 雀傑★★ <span className="numeric">232/1400</span>
          </div>
        </div>
      </section>
    </div>
  );
}
