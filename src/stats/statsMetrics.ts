import type { PlayerExtendedStats } from '../api';

/**
 * 表示対象の 52 キー（§1.1）。除外は3つ:
 *   roundCount    メタ情報（局数）
 *   recentBigLoss オブジェクト。指標ではない
 *   立直好型      オーナー判断で非表示（R-12。「何かの数値と同じ」）
 */
export type StatsKey = Exclude<keyof PlayerExtendedStats, 'roundCount' | 'recentBigLoss' | '立直好型'>;

/** 'distribution' は和銃分布セクション専用（回数 / 割合 の併記・R-13） */
export type StatUnit = 'rate' | 'point' | 'turn' | 'count' | 'shanten' | 'distribution';

export type StatSectionId =
  | 'rank'
  | 'overall1'
  | 'overall2'
  | 'efficiency'
  | 'growth'
  | 'riichi'
  | 'call'
  | 'distribution'
  | 'luck';

/** 導出行の識別子。API キーを持たない行 */
export type DerivedRowId = 'roundBalance' | 'dealInStateConcealed';

export interface StatMetricSpec {
  readonly kind: 'metric';
  readonly key: string; // 'winRate' 等の安定キー（data-metric / テスト用）
  readonly statsKey: StatsKey;
  readonly label: string;
  readonly unit: StatUnit;
  readonly suffix?: string; // '回' | '飜' | '連荘'
  readonly note: string; // 分母注記＝ツールチップ本文。空文字可（R-14）
  readonly tentative?: true; // §2.3 の未確定項目（Q3: 被炸率のみ）
}

export interface DerivedRowSpec {
  readonly kind: 'derived';
  readonly key: DerivedRowId;
  readonly label: string;
  readonly unit: StatUnit;
  readonly suffix?: string;
  readonly note: string;
}

export type StatRowSpec = StatMetricSpec | DerivedRowSpec;

export interface StatSectionSpec {
  readonly id: StatSectionId;
  readonly title: string;
  readonly rows: readonly StatRowSpec[]; // 'rank' と 'growth' と 'overall1' は専用ビルダが組む
}

export const STAT_SECTIONS: readonly StatSectionSpec[] = [
  {
    id: 'rank',
    title: '順位分布',
    rows: [],
  },
  {
    id: 'overall1',
    title: '総合成績1',
    rows: [],
  },
  {
    id: 'overall2',
    title: '総合成績2',
    rows: [
      {
        kind: 'metric',
        key: 'winRate',
        statsKey: '和牌率',
        label: '和了率',
        unit: 'rate',
        note: '和了回数 / 配牌回数',
      },
      {
        kind: 'metric',
        key: 'dealInRate',
        statsKey: '放铳率',
        label: '放銃率',
        unit: 'rate',
        note: '放銃回数 / 配牌回数',
      },
      {
        kind: 'metric',
        key: 'tsumoRate',
        statsKey: '自摸率',
        label: 'ツモ率',
        unit: 'rate',
        note: '和了回数比',
      },
      {
        kind: 'metric',
        key: 'callRate',
        statsKey: '副露率',
        label: '副露率',
        unit: 'rate',
        note: '副露した局数 / 配牌回数',
      },
      {
        kind: 'metric',
        key: 'drawRate',
        statsKey: '流局率',
        label: '流局率',
        unit: 'rate',
        note: '流局回数 / 配牌回数',
      },
      {
        kind: 'metric',
        key: 'drawTenpaiRate',
        statsKey: '流听率',
        label: '流局聴牌率',
        unit: 'rate',
        note: '流局回数比',
      },
      {
        kind: 'metric',
        key: 'avgWinTurn',
        statsKey: '和了巡数',
        label: '平均和了巡目',
        unit: 'turn',
        note: '',
      },
      {
        kind: 'metric',
        key: 'damatenRate',
        statsKey: '默听率',
        label: '闇聴率',
        unit: 'rate',
        note: '和了回数比',
      },
    ],
  },
  {
    id: 'efficiency',
    title: '効率指標',
    rows: [
      {
        kind: 'metric',
        key: 'avgWinScore',
        statsKey: '平均打点',
        label: '平均打点',
        unit: 'point',
        note: '',
      },
      {
        kind: 'metric',
        key: 'winEfficiency',
        statsKey: '打点效率',
        label: '打点効率',
        unit: 'point',
        note: '平均打点 × 和了率',
      },
      {
        kind: 'metric',
        key: 'avgDealInScore',
        statsKey: '平均铳点',
        label: '平均放銃点',
        unit: 'point',
        note: '',
      },
      {
        kind: 'metric',
        key: 'lossEfficiency',
        statsKey: '铳点损失',
        label: '銃点損失',
        unit: 'point',
        note: '平均放銃点 × 放銃率',
      },
      {
        kind: 'metric',
        key: 'netEfficiency',
        statsKey: '净打点效率',
        label: '調整打点効率',
        unit: 'point',
        note: '打点効率 − 銃点損失',
      },
      {
        kind: 'derived',
        key: 'roundBalance',
        label: '局収支',
        unit: 'point',
        note: '(平均持ち点 − 配給原点) × 記録対戦数 / 総計局数',
      },
    ],
  },
  {
    id: 'growth',
    title: '成長指標',
    rows: [],
  },
  {
    id: 'riichi',
    title: '立直統計',
    rows: [
      {
        kind: 'metric',
        key: 'riichiRate',
        statsKey: '立直率',
        label: '立直率',
        unit: 'rate',
        note: '立直回数 / 配牌回数',
      },
      {
        kind: 'metric',
        key: 'riichiWinRate',
        statsKey: '立直后和牌率',
        label: '立直成功率',
        unit: 'rate',
        note: '立直後に和了した割合',
      },
      {
        kind: 'metric',
        key: 'riichiDealInRate',
        statsKey: '立直后放铳率',
        label: '立直後放銃率A',
        unit: 'rate',
        note: '立直した局で放銃した割合（立直した瞬間を含む）',
      },
      {
        kind: 'metric',
        key: 'riichiDealInRateNonImmediate',
        statsKey: '立直后非瞬间放铳率',
        label: '立直後放銃率B',
        unit: 'rate',
        note: '立直した局で放銃した割合（立直した瞬間を除く）',
      },
      {
        kind: 'metric',
        key: 'riichiBalance',
        statsKey: '立直收支',
        label: '立直収支',
        unit: 'point',
        note: '立直後の収支(供託含む) / 立直回数',
      },
      {
        kind: 'metric',
        key: 'riichiIncome',
        statsKey: '立直收入',
        label: '立直収入',
        unit: 'point',
        note: '立直和了収入(供託含む) / 立直後の和了回数',
      },
      {
        kind: 'metric',
        key: 'riichiExpense',
        statsKey: '立直支出',
        label: '立直支出',
        unit: 'point',
        note: '立直後の放銃支出(供託含む) / 立直後の放銃回数',
      },
      {
        kind: 'metric',
        key: 'riichiFirst',
        statsKey: '先制率',
        label: '先制立直率',
        unit: 'rate',
        note: 'その局で初めて立直した割合',
      },
      {
        kind: 'metric',
        key: 'riichiChase',
        statsKey: '追立率',
        label: '追っかけ率',
        unit: 'rate',
        note: '追っかけ立直をした回数 / 立直回数',
      },
      {
        kind: 'metric',
        key: 'riichiChased',
        statsKey: '被追率',
        label: '立直後追っかけられ率',
        unit: 'rate',
        note: '他家に追いかけ立直された回数 / 立直回数',
      },
      {
        kind: 'metric',
        key: 'riichiTurn',
        statsKey: '立直巡目',
        label: '平均立直巡目',
        unit: 'turn',
        note: '',
      },
      {
        kind: 'metric',
        key: 'riichiDrawRate',
        statsKey: '立直后流局率',
        label: '立直後流局率',
        unit: 'rate',
        note: '立直した局が流局した回数 / 立直回数',
      },
      {
        kind: 'metric',
        key: 'ippatsuRate',
        statsKey: '一发率',
        label: '一発率',
        unit: 'rate',
        note: '一発回数 / 立直和了回数',
      },
      {
        kind: 'metric',
        key: 'riichiFuriten',
        statsKey: '振听立直率',
        label: '振聴立直率',
        unit: 'rate',
        note: '立直後の見逃しは含まない',
      },
      {
        kind: 'metric',
        key: 'riichiMultiWait',
        statsKey: '立直多面',
        label: '立直多面率',
        unit: 'rate',
        note: '2面待ち以上',
      },
      {
        kind: 'metric',
        key: 'riichiGoodShape2',
        statsKey: '立直好型2',
        label: '立直良形率',
        unit: 'rate',
        note: '宣言時に待ちが自分から見て6枚以上',
      },
    ],
  },
  {
    id: 'call',
    title: '副露統計',
    rows: [
      {
        kind: 'metric',
        key: 'callDealInRate',
        statsKey: '副露后放铳率',
        label: '副露後放銃率',
        unit: 'rate',
        note: '副露後放銃回数 / 副露した局数',
      },
      {
        kind: 'metric',
        key: 'callWinRate',
        statsKey: '副露后和牌率',
        label: '副露後和了率',
        unit: 'rate',
        note: '副露和了回数 / 副露した局数',
      },
      {
        kind: 'metric',
        key: 'callDrawRate',
        statsKey: '副露后流局率',
        label: '副露後流局率',
        unit: 'rate',
        note: '副露流局回数 / 副露した局数',
      },
    ],
  },
  {
    id: 'distribution',
    title: '和銃分布',
    rows: [
      {
        kind: 'metric',
        key: 'winStateRiichi',
        statsKey: '立直和了',
        label: '和了時 立直',
        unit: 'distribution',
        note: '和了回数のうちの実測値',
      },
      {
        kind: 'metric',
        key: 'winStateCall',
        statsKey: '副露和了',
        label: '和了時 副露',
        unit: 'distribution',
        note: '和了回数のうちの実測値',
      },
      {
        kind: 'metric',
        key: 'winStateDamaten',
        statsKey: '默听和了',
        label: '和了時 闇聴',
        unit: 'distribution',
        note: '和了回数のうちの実測値',
      },
      {
        kind: 'metric',
        key: 'dealInStateRiichi',
        statsKey: '放铳时立直率',
        label: '放銃時 立直',
        unit: 'distribution',
        note: '放銃回数（放銃率 × 局数）× 各割合。API に回数の生データが無いため丸めた値',
      },
      {
        kind: 'metric',
        key: 'dealInStateCall',
        statsKey: '放铳时副露率',
        label: '放銃時 副露',
        unit: 'distribution',
        note: '放銃回数（放銃率 × 局数）× 各割合。API に回数の生データが無いため丸めた値',
      },
      {
        kind: 'derived',
        key: 'dealInStateConcealed',
        label: '放銃時 門前',
        unit: 'distribution',
        note: '放銃回数（放銃率 × 局数）× 各割合。API に回数の生データが無いため丸めた値',
      },
      {
        kind: 'metric',
        key: 'dealInTargetRiichi',
        statsKey: '放铳至立直',
        label: '放銃相手 立直',
        unit: 'distribution',
        note: '放銃回数（放銃率 × 局数）× 各割合。ダブロン・トリロンのぶん実際の和了者数は放銃回数より数%多いため、やや少なめに出る',
      },
      {
        kind: 'metric',
        key: 'dealInTargetCall',
        statsKey: '放铳至副露',
        label: '放銃相手 副露',
        unit: 'distribution',
        note: '放銃回数（放銃率 × 局数）× 各割合。ダブロン・トリロンのぶん実際の和了者数は放銃回数より数%多いため、やや少なめに出る',
      },
      {
        kind: 'metric',
        key: 'dealInTargetDamaten',
        statsKey: '放铳至默听',
        label: '放銃相手 闇聴',
        unit: 'distribution',
        note: '放銃回数（放銃率 × 局数）× 各割合。ダブロン・トリロンのぶん実際の和了者数は放銃回数より数%多いため、やや少なめに出る',
      },
    ],
  },
  {
    id: 'luck',
    title: '幸運度',
    rows: [
      {
        kind: 'metric',
        key: 'maxRenchan',
        statsKey: '最大连庄',
        label: '最大連荘',
        unit: 'count',
        suffix: '連荘',
        note: '',
      },
      {
        kind: 'metric',
        key: 'uradoraRate',
        statsKey: '里宝率',
        label: '裏ドラ率',
        unit: 'rate',
        note: '裏ドラのある和了回数 / 立直和了回数',
      },
      {
        kind: 'metric',
        key: 'hitByTsumoRate',
        statsKey: '被炸率',
        label: '痛い親かぶり率',
        unit: 'rate',
        note: '親番で満貫以上のツモられ回数 / 親番でのツモられ回数',
        tentative: true,
      },
      {
        kind: 'metric',
        key: 'avgHitByTsumoScore',
        statsKey: '平均被炸点数',
        label: '痛い親かぶり平均',
        unit: 'point',
        note: '満貫以上の親かぶり点数 / 回数',
      },
      {
        kind: 'metric',
        key: 'yakuman',
        statsKey: '役满',
        label: '役満',
        unit: 'count',
        suffix: '回',
        note: '',
      },
      {
        kind: 'metric',
        key: 'countedYakuman',
        statsKey: '累计役满',
        label: '数え役満',
        unit: 'count',
        suffix: '回',
        note: '',
      },
      {
        kind: 'metric',
        key: 'maxFan',
        statsKey: '最大累计番数',
        label: '最大合計飜数',
        unit: 'count',
        suffix: '飜',
        note: '',
      },
      {
        kind: 'metric',
        key: 'nagashiMangan',
        statsKey: '流满',
        label: '流し満貫',
        unit: 'count',
        suffix: '回',
        note: '',
      },
      {
        kind: 'metric',
        key: 'doubleRiichi',
        statsKey: 'W立直',
        label: 'ダブル立直',
        unit: 'count',
        suffix: '回',
        note: '',
      },
      {
        kind: 'metric',
        key: 'avgShanten',
        statsKey: '平均起手向听',
        label: '配牌平均向聴',
        unit: 'shanten',
        note: '',
      },
      {
        kind: 'metric',
        key: 'avgShantenDealer',
        statsKey: '平均起手向听亲',
        label: '親配牌平均向聴',
        unit: 'shanten',
        note: '',
      },
      {
        kind: 'metric',
        key: 'avgShantenNonDealer',
        statsKey: '平均起手向听子',
        label: '子配牌平均向聴',
        unit: 'shanten',
        note: '',
      },
    ],
  },
];

/**
 * 52キーの網羅を型で強制する索引。STAT_SECTIONS に載せた statsKey を
 * ここにも書く。1つでも欠けると tsc が Record の不足を報告する。
 * 逆に除外3キー（roundCount / recentBigLoss / 立直好型）を書くと
 * StatsKey に存在しないため「余分なプロパティ」で tsc が落ちる。
 */
export const STATS_KEY_COVERAGE: Readonly<Record<StatsKey, StatSectionId>> = {
  // overall2 (8)
  和牌率: 'overall2',
  放铳率: 'overall2',
  自摸率: 'overall2',
  副露率: 'overall2',
  流局率: 'overall2',
  流听率: 'overall2',
  和了巡数: 'overall2',
  默听率: 'overall2',

  // efficiency (5)
  平均打点: 'efficiency',
  打点效率: 'efficiency',
  平均铳点: 'efficiency',
  铳点损失: 'efficiency',
  净打点效率: 'efficiency',

  // riichi (16)
  立直率: 'riichi',
  立直后和牌率: 'riichi',
  立直后放铳率: 'riichi',
  立直后非瞬间放铳率: 'riichi',
  立直收支: 'riichi',
  立直收入: 'riichi',
  立直支出: 'riichi',
  先制率: 'riichi',
  追立率: 'riichi',
  被追率: 'riichi',
  立直巡目: 'riichi',
  立直后流局率: 'riichi',
  一发率: 'riichi',
  振听立直率: 'riichi',
  立直多面: 'riichi',
  立直好型2: 'riichi',

  // call (3)
  副露后放铳率: 'call',
  副露后和牌率: 'call',
  副露后流局率: 'call',

  // distribution (8)
  立直和了: 'distribution',
  副露和了: 'distribution',
  默听和了: 'distribution',
  放铳时立直率: 'distribution',
  放铳时副露率: 'distribution',
  放铳至立直: 'distribution',
  放铳至副露: 'distribution',
  放铳至默听: 'distribution',

  // luck (12)
  最大连庄: 'luck',
  里宝率: 'luck',
  被炸率: 'luck',
  平均被炸点数: 'luck',
  役满: 'luck',
  累计役满: 'luck',
  最大累计番数: 'luck',
  流满: 'luck',
  W立直: 'luck',
  平均起手向听: 'luck',
  平均起手向听亲: 'luck',
  平均起手向听子: 'luck',
};
