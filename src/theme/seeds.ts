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
