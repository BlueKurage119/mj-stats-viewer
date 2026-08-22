/**
 * ワイヤ型（Raw*）と公開型の分離（docs/design/issue-3-api-layer.md §4）。
 *
 * Raw* は実レスポンス（§1 で保存した JSON）に忠実な型。回数系キーは optional。
 * このファイル内でのみ使用し、バレル（index.ts）からは公開しない。
 * 公開型は normalize.ts が変換して返す。
 */

import type { GameMode } from './gameMode';

// ============================================================
// ワイヤ型（Raw*） — バレル非公開
// ============================================================

export type RawLevelWithDelta = {
  id: number;
  score: number;
  delta: number;
};

/** search_player の1要素。latest_timestamp は秒単位（§1.3 差分6） */
export type RawPlayerSearchResult = {
  id: number;
  nickname: string;
  /** 注意: pl4 検索でも三麻 levelId (2xxxx) が返りうる（§1.3 差分4） */
  level: RawLevelWithDelta;
  latest_timestamp: number;
};

/** player_stats の実レスポンス形状（§1.3 の9番。extended_stats/cross_stats はワイヤに乗らない） */
export type RawPlayerStats = {
  count: number; // 試合数
  level: RawLevelWithDelta;
  max_level: RawLevelWithDelta;
  rank_rates: number[];
  rank_avg_score: number[];
  avg_rank: number;
  negative_rate: number;
  id: number;
  nickname: string;
  played_modes: number[]; // number 配列で返る（§1.3 差分5）
};

export type RawFanStatEntry = { id: number; label: string; count: number; 役满: number };

/** 最近大铳。start_time は秒単位 */
export type RawRecentBigLoss = {
  id: string;
  start_time: number;
  fans: RawFanStatEntry[];
};

/**
 * player_extended_stats の実レスポンス形状。
 * 回数系6キーは値0のときキー自体が省略される（§1.3 差分8）。
 * id / played_modes は本家型に無いが実レスポンスには含まれる（§1.3 差分3）。
 */
export type RawPlayerExtendedStats = {
  count: number; // 局数
  最大连庄?: number;
  最大累计番数?: number;
  役满?: number;
  累计役满?: number;
  W立直?: number;
  流满?: number;
  和牌率: number;
  自摸率: number;
  默听率: number;
  放铳率: number;
  副露率: number;
  立直率: number;
  平均打点: number;
  和了巡数: number;
  平均铳点: number;
  流局率: number;
  流听率: number;
  一发率: number;
  里宝率: number;
  被炸率: number;
  平均被炸点数: number;
  放铳时立直率: number;
  放铳时副露率: number;
  立直后放铳率: number;
  立直后非瞬间放铳率: number;
  副露后放铳率: number;
  立直后和牌率: number;
  副露后和牌率: number;
  立直后流局率: number;
  副露后流局率: number;
  放铳至立直: number;
  放铳至副露: number;
  放铳至默听: number;
  立直和了: number;
  副露和了: number;
  默听和了: number;
  立直巡目: number;
  立直收支: number;
  立直收入: number;
  立直支出: number;
  先制率: number;
  追立率: number;
  被追率: number;
  振听立直率: number;
  立直好型: number;
  立直好型2: number;
  立直多面: number;
  打点效率: number;
  铳点损失: number;
  净打点效率: number;
  平均起手向听: number;
  平均起手向听亲?: number;
  平均起手向听子?: number;
  id?: number;
  played_modes?: number[];
  最近大铳?: RawRecentBigLoss;
};

export type RawGlobalStatisticsBasic = {
  count: number;
  rank_rates: number[];
  avg_rank: number;
  negative_rate: number;
};

export type RawGlobalStatisticsEntry = {
  basic: RawGlobalStatisticsBasic;
  extended: RawPlayerExtendedStats;
};

/** トップキーはリクエストした mode 文字列そのもの（§1.3 差分2）。その下が levelId 文字列 */
export type RawGlobalStatistics = {
  [modeKey: string]: { [levelId: string]: RawGlobalStatisticsEntry };
};

// ============================================================
// 公開型
// ============================================================

export type LevelWithDelta = {
  id: number; // levelId（仕様書 §4.3。解釈・表示は Issue 4）
  score: number;
  delta: number; // 現在ポイント = score + delta（仕様書 §4.5）
};

export type PlayerSearchResult = {
  id: number;
  nickname: string;
  /** 注意: pl4 検索でも三麻 levelId (2xxxx) が返りうる（§1.3 差分4） */
  level: LevelWithDelta;
  lastPlayedAtMs: number; // ワイヤ latest_timestamp（秒）からミリ秒に変換（Issue 23 §1.2。Date は freeze で保護できないため不採用）
};

export type PlayerStats = {
  id: number;
  nickname: string;
  gameCount: number; // ワイヤ count（試合数）
  /** クエリ範囲内の最終対局時点のスナップショット。現在段位には getCurrentLevel を使う */
  level: LevelWithDelta;
  max_level: LevelWithDelta; // 同上（クエリ範囲内の最大）
  rank_rates: number[]; // 長さ 4（四麻）/ 3（三麻）
  rank_avg_score: number[]; // 同上
  avg_rank: number;
  negative_rate: number;
  played_modes: GameMode[]; // number で返ることを実測確認済み（§1.3 差分5）
};

export type FanStatEntry = { id: number; label: string; count: number; 役满: number };

export type PlayerExtendedStats = {
  roundCount: number; // ワイヤ count（局数）
  // --- 回数系6キー: ワイヤでは値0のときキー省略 → 0 補完して必須化 ---
  最大连庄: number;
  最大累计番数: number;
  役满: number;
  累计役满: number;
  W立直: number;
  流满: number;
  // --- 率・点数系（実レスポンスで全て存在を確認したもの。中国語キーはワイヤのまま） ---
  和牌率: number;
  自摸率: number;
  默听率: number;
  放铳率: number;
  副露率: number;
  立直率: number;
  平均打点: number;
  和了巡数: number;
  平均铳点: number;
  流局率: number;
  流听率: number;
  一发率: number;
  里宝率: number;
  被炸率: number;
  平均被炸点数: number;
  放铳时立直率: number;
  放铳时副露率: number;
  立直后放铳率: number;
  立直后非瞬间放铳率: number;
  副露后放铳率: number;
  立直后和牌率: number;
  副露后和牌率: number;
  立直后流局率: number;
  副露后流局率: number;
  放铳至立直: number;
  放铳至副露: number;
  放铳至默听: number;
  立直和了: number;
  副露和了: number;
  默听和了: number;
  立直巡目: number;
  立直收支: number;
  立直收入: number;
  立直支出: number;
  先制率: number;
  追立率: number;
  被追率: number;
  振听立直率: number;
  立直好型: number;
  立直好型2: number;
  立直多面: number;
  打点效率: number;
  铳点损失: number;
  净打点效率: number;
  平均起手向听: number;
  // --- 母数条件により欠落しうるもの（0 補完すると意味が変わるため optional のまま） ---
  平均起手向听亲?: number; // 親番が無いと欠落しうる（本家型で optional）
  平均起手向听子?: number;
  recentBigLoss?: {
    // ワイヤ 最近大铳（start_time 秒 → ミリ秒の number に変換・改名。Issue 23 §1.2）
    id: string;
    startedAtMs: number;
    fans: FanStatEntry[];
  };
};

export type GlobalStatisticsEntry = {
  // num_players はワイヤに存在しない（§1.3 差分2）
  basic: {
    gameCount: number; // ワイヤ count
    rank_rates: number[];
    avg_rank: number;
    negative_rate: number;
  };
  extended: PlayerExtendedStats; // 回数系キーは同じ 0 補完を適用（§1.3 差分8）
};
/** キー: levelId 文字列（例 "10503"、魂天は "10701"〜個別） */
export type GlobalStatistics = { [levelId: string]: GlobalStatisticsEntry };

export type HistogramData = { min: number; max: number; bins: number[] };
export type HistogramGroup = {
  mean: number;
  histogramFull?: HistogramData; // band "0" のみ存在
  histogramClamped?: HistogramData; // band "0" かつ回数系6指標以外のみ存在
};
/** metric キー56種（PlayerExtendedStats のキー ∪ {count, 对局数, 局收支, 立直好型}） */
export type GlobalHistogramLevelBand = { [metric: string]: HistogramGroup };
/**
 * modeId("8"等・単一モード) → band → metric。
 * band "0" = 卓全体（histogramFull あり）、その他 = 段位帯（mean のみ）。
 * 魂天は "10799" に合算される（王座の間のみ・実測）。
 */
export type GlobalHistogram = {
  [modeId: string]: { [levelBand: string]: GlobalHistogramLevelBand };
};

/** [zone(1=中国 2=日本 3=英語圏), levelId, num_players] */
export type LevelStatisticsItem = [number, number, number];
export type LevelStatistics = LevelStatisticsItem[];
