import type { GameMode, PlayerExtendedStats, PlayerStats } from '../api';
import { formatMetricValue } from '../compare/histogramView';
import { dealInStateBreakdown, rentaiRate, roundBalance } from '../domain';
import { buildRankView } from '../summary/rankView';
import type { GrowthView } from './growthView';
import {
  STAT_SECTIONS,
  type StatMetricSpec,
  type StatSectionId,
  type StatUnit,
} from './statsMetrics';

export interface StatRow {
  readonly key: string;
  readonly label: string;
  readonly note: string; // ツールチップ本文。空文字可（R-14）。表形式化された rank / distribution は空文字
  readonly valueText: string; // '36.5%' | '5,312' | '9.87巡' | '3回' | '—'
  readonly countText?: string;
  readonly percentText?: string;
  readonly avgScoreText?: string;
  readonly subGroup?: 'winState' | 'dealInState' | 'dealInTarget';
}

export interface StatSectionView {
  readonly id: StatSectionId;
  readonly title: string;
  readonly rows: readonly StatRow[];
  readonly note: string | null; // セクション見出し直下の注記
}

/** unit → テキスト。'rate'|'point'|'turn' は compare の formatMetricValue に委譲する */
export function formatStatValue(
  value: number | null | undefined,
  unit: StatUnit,
  suffix?: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  switch (unit) {
    case 'rate':
    case 'point':
    case 'turn':
      return formatMetricValue(value, unit);
    case 'count': {
      const rounded = Math.round(value);
      return `${rounded.toLocaleString('ja-JP')}${suffix ?? ''}`;
    }
    case 'shanten':
      return value.toFixed(2);
    case 'distribution':
      return '—';
  }
}

/**
 * 和銃分布セクション専用の値テキスト（R-13・§2.2-8）。
 * count が null（概算不能）のときは割合だけを出す。
 * approximate = true のとき回数に「約」を付ける（概算と実測の区別・必須）。
 */
export function formatDistributionValue(input: {
  readonly count: number | null;
  readonly rate: number | null;
  readonly approximate: boolean;
}): string {
  const isCountValid =
    input.count !== null && typeof input.count === 'number' && Number.isFinite(input.count);
  const isRateValid =
    input.rate !== null && typeof input.rate === 'number' && Number.isFinite(input.rate);

  if (!isCountValid && !isRateValid) {
    return '—';
  }

  const countPart = isCountValid
    ? `${input.approximate ? '約' : ''}${formatStatValue(input.count, 'count', '回')}`
    : '—';
  const ratePart = isRateValid ? formatStatValue(input.rate, 'rate') : '—';

  return `${countPart} / ${ratePart}`;
}

const RIICHI_NOTE_TEXT =
  '※立直収支の計算には、横移動・流局・ツモられも含むため、立直収入と立直支出の差とは必ずしも一致しない。';

export function buildStatsView(input: {
  readonly stats: PlayerStats;
  readonly extended: PlayerExtendedStats | null;
  readonly growth: GrowthView | null;
  readonly baseMode: GameMode | null;
  readonly numPlayers: 3 | 4;
}): readonly StatSectionView[] {
  const { stats, extended, growth, baseMode, numPlayers } = input;
  const rankView = buildRankView({ stats, extended });

  return STAT_SECTIONS.map((section): StatSectionView => {
    switch (section.id) {
      case 'rank': {
        const sliceCount = numPlayers === 4 ? 4 : 3;
        const rows: StatRow[] = [];
        for (let i = 0; i < sliceCount; i++) {
          const slice = rankView?.slices[i];
          const rankNum = i + 1;
          const countText = slice ? `${slice.countText}回` : '—';
          const percentText = slice ? `${slice.percentText}%` : '—';
          const avgScore = stats.rank_avg_score?.[i];
          const avgScoreText =
            typeof avgScore === 'number' && Number.isFinite(avgScore)
              ? `${Math.round(avgScore).toLocaleString('ja-JP')}点`
              : '—';

          rows.push({
            key: `rank${rankNum}`,
            label: `${rankNum}位`,
            valueText: slice ? `${slice.percentText}%` : '—',
            note: '', // 2026-09-07 UI調整: 表形式化によりツールチップ注記は不要
            countText,
            percentText,
            avgScoreText,
          });
        }
        return {
          id: 'rank',
          title: section.title,
          rows,
          note: null,
        };
      }

      case 'overall1': {
        const roundCountVal = extended?.roundCount;
        const roundCountText =
          typeof roundCountVal === 'number' && Number.isFinite(roundCountVal)
            ? `${roundCountVal.toLocaleString('ja-JP')}局`
            : '—';

        const avgRankTile = rankView?.tiles.find((t) => t.key === 'avgRank');
        const rentaiTile = rankView?.tiles.find((t) => t.key === 'rentai');
        const negativeTile = rankView?.tiles.find((t) => t.key === 'negative');
        const avgScoreTile = rankView?.tiles.find((t) => t.key === 'avgScore');

        // R-10: 四麻は「逆連対率」、三麻は「ラス率」。値は 1 - rentaiRate(stats.rank_rates)
        // tiles.last.value は使わない
        const rentai = rentaiRate(stats.rank_rates);
        const lastRateVal = Number.isFinite(rentai) ? 1 - rentai : null;
        const lastValueText = formatStatValue(lastRateVal, 'rate');
        const lastLabel = numPlayers === 4 ? '逆連対率' : 'ラス率';
        const lastNote =
          numPlayers === 4 ? '3位以下（3位+4位）の割合' : '3位（最下位）の割合';

        const rows: StatRow[] = [
          {
            key: 'gameCount',
            label: '記録対戦数',
            valueText: rankView ? `${rankView.gameCountText}戦` : '—',
            note: '選択中の期間・モードの対局数',
          },
          {
            key: 'roundCount',
            label: '総計局数',
            valueText: roundCountText,
            note: '選択中の期間・モードの配牌回数',
          },
          {
            key: 'avgRank',
            label: '平均順位',
            valueText: avgRankTile ? `${avgRankTile.value}位` : '—',
            note: '順位の平均。小数第2位まで表示',
          },
          {
            key: 'rentai',
            label: '連対率',
            valueText: rentaiTile ? rentaiTile.value : '—',
            note: '2位以上の割合',
          },
          {
            key: 'last',
            label: lastLabel,
            valueText: lastValueText,
            note: lastNote,
          },
          {
            key: 'negative',
            label: '飛び率',
            valueText: negativeTile ? negativeTile.value : '—',
            note: '0点未満で終局した割合',
          },
          {
            key: 'avgScore',
            label: '平均持ち点',
            valueText: avgScoreTile ? `${avgScoreTile.value}点` : '—',
            note: '終局時の平均点棒',
          },
        ];

        return {
          id: 'overall1',
          title: section.title,
          rows,
          note: null,
        };
      }

      case 'overall2': {
        const rows: StatRow[] = section.rows.map((r) => {
          const spec = r as StatMetricSpec;
          const val = extended ? extended[spec.statsKey] : null;
          return {
            key: spec.key,
            label: spec.label,
            valueText: formatStatValue(val, spec.unit),
            note: spec.note,
          };
        });
        return {
          id: 'overall2',
          title: section.title,
          rows,
          note: null,
        };
      }

      case 'efficiency': {
        const rows: StatRow[] = section.rows.map((r) => {
          if (r.kind === 'derived' && r.key === 'roundBalance') {
            const hasRoundCount =
              extended &&
              typeof extended.roundCount === 'number' &&
              Number.isFinite(extended.roundCount) &&
              extended.roundCount > 0;
            const rbVal =
              baseMode !== null && hasRoundCount
                ? roundBalance({
                    rankRates: stats.rank_rates,
                    rankAvgScores: stats.rank_avg_score,
                    mode: baseMode,
                    gameCount: stats.gameCount,
                    roundCount: extended!.roundCount,
                  })
                : null;
            return {
              key: r.key,
              label: r.label,
              valueText: formatStatValue(rbVal, r.unit),
              note: r.note,
            };
          }
          const spec = r as StatMetricSpec;
          const val = extended ? extended[spec.statsKey] : null;
          return {
            key: spec.key,
            label: spec.label,
            valueText: formatStatValue(val, spec.unit),
            note: spec.note,
          };
        });
        return {
          id: 'efficiency',
          title: section.title,
          rows,
          note: null,
        };
      }

      case 'growth': {
        return {
          id: 'growth',
          title: section.title,
          rows: growth ? growth.rows : [],
          note: growth ? growth.note : null,
        };
      }

      case 'riichi': {
        const rows: StatRow[] = section.rows.map((r) => {
          const spec = r as StatMetricSpec;
          const val = extended ? extended[spec.statsKey] : null;
          return {
            key: spec.key,
            label: spec.label,
            valueText: formatStatValue(val, spec.unit),
            note: spec.note,
          };
        });
        return {
          id: 'riichi',
          title: section.title,
          rows,
          note: RIICHI_NOTE_TEXT,
        };
      }

      case 'call': {
        const rows: StatRow[] = section.rows.map((r) => {
          const spec = r as StatMetricSpec;
          const val = extended ? extended[spec.statsKey] : null;
          return {
            key: spec.key,
            label: spec.label,
            valueText: formatStatValue(val, spec.unit),
            note: spec.note,
          };
        });
        return {
          id: 'call',
          title: section.title,
          rows,
          note: null,
        };
      }

      case 'distribution': {
        // 和了時3キー
        const winRiichi = extended?.立直和了 ?? null;
        const winCall = extended?.副露和了 ?? null;
        const winDamaten = extended?.默听和了 ?? null;

        const hasAllWinCounts =
          typeof winRiichi === 'number' &&
          Number.isFinite(winRiichi) &&
          typeof winCall === 'number' &&
          Number.isFinite(winCall) &&
          typeof winDamaten === 'number' &&
          Number.isFinite(winDamaten);

        const winTotal = hasAllWinCounts ? winRiichi + winCall + winDamaten : null;

        // 放銃時/相手
        const dealInRate = extended?.放铳率;
        const roundCount = extended?.roundCount;
        const canEstimateDealIn =
          typeof dealInRate === 'number' &&
          Number.isFinite(dealInRate) &&
          dealInRate > 0 &&
          typeof roundCount === 'number' &&
          Number.isFinite(roundCount) &&
          roundCount > 0;

        const dealInCount = canEstimateDealIn ? Math.round(dealInRate * roundCount) : null;

        // 門前率の導出
        const breakdown = extended
          ? dealInStateBreakdown({
              放铳率: extended.放铳率,
              放铳时立直率: extended.放铳时立直率,
              放铳时副露率: extended.放铳时副露率,
            })
          : null;
        const dealInConcealedRate = breakdown ? breakdown.默听 : null;

        const rows: StatRow[] = section.rows.map((r): StatRow => {
          if (r.kind === 'derived' && r.key === 'dealInStateConcealed') {
            const count =
              dealInCount !== null && dealInConcealedRate !== null
                ? Math.round(dealInCount * dealInConcealedRate)
                : null;
            const countText = count !== null ? `約${count.toLocaleString('ja-JP')}回` : '—';
            const percentText =
              dealInConcealedRate !== null ? formatStatValue(dealInConcealedRate, 'rate') : '—';
            return {
              key: r.key,
              label: r.label,
              valueText: formatDistributionValue({
                count,
                rate: dealInConcealedRate,
                approximate: true,
              }),
              note: '', // 2026-09-07 UI調整: 表形式化によりツールチップ注記は不要
              countText,
              percentText,
              subGroup: 'dealInState',
            };
          }

          const spec = r as StatMetricSpec;

          // 和了時3行
          if (
            spec.key === 'winStateRiichi' ||
            spec.key === 'winStateCall' ||
            spec.key === 'winStateDamaten'
          ) {
            const count = extended ? (extended[spec.statsKey] as number) : null;
            const isCountFinite = typeof count === 'number' && Number.isFinite(count);
            const rate =
              isCountFinite && winTotal !== null && winTotal > 0 ? count / winTotal : null;
            const countText = isCountFinite ? `${count.toLocaleString('ja-JP')}回` : '—';
            const percentText = rate !== null ? formatStatValue(rate, 'rate') : '—';
            return {
              key: spec.key,
              label: spec.label,
              valueText: formatDistributionValue({
                count: isCountFinite ? count : null,
                rate,
                approximate: false,
              }),
              note: '', // 2026-09-07 UI調整: 表形式化によりツールチップ注記は不要
              countText,
              percentText,
              subGroup: 'winState',
            };
          }

          // 放銃時3行
          if (spec.key === 'dealInStateRiichi' || spec.key === 'dealInStateCall') {
            const rawRate = extended ? (extended[spec.statsKey] as number) : null;
            const isRateFinite = typeof rawRate === 'number' && Number.isFinite(rawRate);
            const count =
              dealInCount !== null && isRateFinite
                ? Math.round(dealInCount * rawRate)
                : null;
            const countText = count !== null ? `約${count.toLocaleString('ja-JP')}回` : '—';
            const percentText = isRateFinite ? formatStatValue(rawRate, 'rate') : '—';
            return {
              key: spec.key,
              label: spec.label,
              valueText: formatDistributionValue({
                count,
                rate: isRateFinite ? rawRate : null,
                approximate: true,
              }),
              note: '', // 2026-09-07 UI調整: 表形式化によりツールチップ注記は不要
              countText,
              percentText,
              subGroup: 'dealInState',
            };
          }

          // 放銃相手3行
          const rawRate = extended ? (extended[spec.statsKey] as number) : null;
          const isRateFinite = typeof rawRate === 'number' && Number.isFinite(rawRate);
          const count =
            dealInCount !== null && isRateFinite
              ? Math.round(dealInCount * rawRate)
              : null;
          const countText = count !== null ? `約${count.toLocaleString('ja-JP')}回` : '—';
          const percentText = isRateFinite ? formatStatValue(rawRate, 'rate') : '—';
          return {
            key: spec.key,
            label: spec.label,
            valueText: formatDistributionValue({
              count,
              rate: isRateFinite ? rawRate : null,
              approximate: true,
            }),
            note: '', // 2026-09-07 UI調整: 表形式化によりツールチップ注記は不要
            countText,
            percentText,
            subGroup: 'dealInTarget',
          };
        });

        return {
          id: 'distribution',
          title: section.title,
          rows,
          note: null,
        };
      }

      case 'luck': {
        const rows: StatRow[] = section.rows.map((r) => {
          const spec = r as StatMetricSpec;
          const val = extended ? extended[spec.statsKey] : null;
          return {
            key: spec.key,
            label: spec.label,
            valueText: formatStatValue(val, spec.unit, spec.suffix),
            note: spec.note,
          };
        });
        return {
          id: 'luck',
          title: section.title,
          rows,
          note: null,
        };
      }
    }
  });
}
