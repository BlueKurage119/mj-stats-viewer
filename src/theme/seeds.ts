/**
 * テーマシード色の単一情報源。
 *
 * 段位別シード・セクション色・levelId → 段位の解決ロジックをここに集約する。
 * 差し替えが必要になった場合はこのファイルの編集のみで完結させる。
 */

/** 段位キー。majorRank 3/4/5/6+ に対応（牌譜屋は金の間以上のみ採譜） */
export type RankKey = 'ketsu' | 'gou' | 'sei' | 'konten';

/** 段位別シード色。差し替えはこのオブジェクトの編集のみで完結する */
export const RANK_SEEDS: Record<RankKey, string> = {
  ketsu: '#E6B422', // 雀傑: 金
  gou: '#F57C00', // 雀豪: 橙
  sei: '#D32F2F', // 雀聖: 赤
  konten: '#1E88E5', // 魂天: 青
};

/** プレイヤー未選択・段位不明時の既定シード（雀卓グリーン） */
export const DEFAULT_SEED = '#1D6B4F';

export type SectionKey = 'win' | 'dealin' | 'riichi' | 'luck';

/** セクション色。blend:false（4系統の相互識別性維持のため。設計書 §2.2） */
export const SECTION_COLORS: Record<SectionKey, string> = {
  win: '#FF7455', // 和了: コーラル
  dealin: '#2D9BF0', // 放銃: ブルー
  riichi: '#9C5BD1', // 立直: パープル
  luck: '#F0A800', // 運: アンバー
};

/**
 * levelId（例: 10503 = 四麻・聖3）→ RankKey。範囲外・undefined は null。
 * API 仕様書 §4.3 の levelId 体系
 * （numPlayerId*10000 + majorRank*100 + minorRank、majorRank 6以上=魂天）に準拠。
 */
export function rankFromLevelId(levelId: number | undefined): RankKey | null {
  if (levelId === undefined) return null;
  const majorRank = Math.floor((levelId % 10000) / 100);
  switch (majorRank) {
    case 3:
      return 'ketsu';
    case 4:
      return 'gou';
    case 5:
      return 'sei';
    default:
      // 旧魂天6・現魂天7の両対応で「6以上」を魂天扱いにする
      return majorRank >= 6 ? 'konten' : null;
  }
}

/** RankKey|null → シードHEX。null は DEFAULT_SEED */
export function seedForRank(rank: RankKey | null): string {
  return rank === null ? DEFAULT_SEED : RANK_SEEDS[rank];
}

/** 順位色のキー（1位〜4位。三麻は1〜3位に rank-1..rank-3 を使う。rank-4 は四麻の4位専用。設計書 issue-9 §3.2-d） */
export type RankColorKey = 'rank-1' | 'rank-2' | 'rank-3' | 'rank-4';

/**
 * 順位色の元値。**雀魂本家準拠で「金・銀・銅・緑」**（オーナー確定・2026-09-05）。
 *
 * 実測メモ（`TonalPalette.fromInt(x).tone(RANK_COLOR_TONES[...])` を通した結果）:
 * - 色相の化けは起きない（銀は彩度9.3だが色相240を保持する）
 * - 背景コントラストは light 3.48〜6.89 / dark 7.09〜13.23 で、いずれも 3:1 以上
 * - 相互コントラストの最小は 1.23（金/銅）。**スライス間の隙間（§3.3）は必須のまま**
 * - light の銀は `#50585f`（暗いスレート）になる。白背景で「銀らしい明るさ」を出すと
 *   コントラスト 3:1 を割るため原理的な制約。青寄せの要否は UI 検証で判断する
 */
export const RANK_COLOR_SOURCES: Record<RankColorKey, string> = {
  'rank-1': '#D4AF37', // 1位: 金
  'rank-2': '#A8B0B8', // 2位: 銀（色相240の低彩度。青寄せの調整余地あり）
  'rank-3': '#B87333', // 3位（四麻・三麻とも）: 銅
  'rank-4': '#3E9E62', // 4位（四麻のみ・メダル圏外）: 緑
};

/**
 * 順位ごとに違うトーンを当てる。
 * MD3 の customColor ロール（light 40 / dark 80 固定）を使うと4色の輝度が揃い、
 * 隣接コントラストが 1.00 になってグレースケールで区別できなくなる（設計書 issue-9 §1.2 実測）。
 */
export const RANK_COLOR_TONES: Record<'light' | 'dark', Record<RankColorKey, number>> = {
  light: { 'rank-1': 56, 'rank-2': 37, 'rank-3': 50, 'rank-4': 43 },
  dark: { 'rank-1': 87, 'rank-2': 66, 'rank-3': 80, 'rank-4': 73 },
};

/**
 * 差分チップの「良い」側の色。
 *
 * 段位シードから独立させる理由（issue-11 §1.5 実測）:
 * 雀聖シード（#D32F2F）の --md-sys-color-primary は light `#ba1a20` / dark `#ffb3ac` で、
 * シード非依存の --md-sys-color-error（`#ba1a1a` / `#ffb4ab`）とほぼ同色になる。
 * primary / tertiary を「良い」に使うと、雀聖のプレイヤーで良い差分と悪い差分が同色になり破綻する。
 *
 * トーンは error とのコントラスト対称性で選んだ（ElevatedCard 背景 = surface-container-low に対し
 * 全5シードで light 5.81〜5.84 / dark 10.01〜10.06。error は light 5.83〜5.86 / dark 10.07〜10.13）。
 * MD3 の customColor ロール（light 40 / dark 80）と同値だが、customColors 経由にすると
 * on-color / container まで4トークン増えるため、順位色と同じく TonalPalette から1トークンだけ出す。
 */
export const DELTA_GOOD_SOURCE = '#2E7D32';
export const DELTA_GOOD_TONES: Record<'light' | 'dark', number> = { light: 40, dark: 80 };
