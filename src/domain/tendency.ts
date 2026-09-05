/**
 * 傾向2軸（攻守 / 副露速度）と5段階バンド。
 * 係数は全項目等係数（符号のみ）とし、有効な項を合成して単位 SD に正規化する
 * （Σ(有効な項) / sqrt(有効な項数)）。
 * 詳細: docs/design/issue-4-domain-logic.md §5.3 / docs/design/issue-10-playstyle.md §3.1
 */

import type { PlayerExtendedStats } from '../api';
import { deviationValue, type MetricDistribution } from './distribution';

export type TendencyInput = Pick<PlayerExtendedStats, '立直率' | '追立率' | '放铳率' | '默听率' | '副露率' | '和了巡数'>;
export type TendencyAxis = { value: number; band: 0 | 1 | 2 | 3 | 4 } | null;
export type Tendency = { offenseDefense: TendencyAxis; concealedSpeed: TendencyAxis };

function zScore(lookup: (metric: string) => MetricDistribution | null, metric: string, x: number): number | null {
  const d = lookup(metric);
  if (!d) return null;
  return (deviationValue(x, d) - 50) / 10;
}

/** 単位 SD への正規化: Σ(values) / sqrt(項数)（項数1のときはその値そのもの） */
function normalized(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / Math.sqrt(values.length);
}

export function calcTendency(stats: TendencyInput, lookup: (metric: string) => MetricDistribution | null): Tendency {
  const zRiichi = zScore(lookup, '立直率', stats.立直率);
  const zOitachi = zScore(lookup, '追立率', stats.追立率);
  const zHoujuu = zScore(lookup, '放铳率', stats.放铳率);
  const zMoten = zScore(lookup, '默听率', stats.默听率);

  const offenseTerms = [zRiichi, zOitachi, zHoujuu, zMoten === null ? null : -zMoten].filter(
    (v): v is number => v !== null,
  );
  const offenseDefense: TendencyAxis = offenseTerms.length
    ? { value: normalized(offenseTerms), band: toBand(normalized(offenseTerms)) }
    : null;

  const zFuro = zScore(lookup, '副露率', stats.副露率);
  const zJunsu = zScore(lookup, '和了巡数', stats.和了巡数);

  const speedTerms = [zFuro, zMoten === null ? null : -zMoten, zJunsu === null ? null : -zJunsu].filter(
    (v): v is number => v !== null,
  );
  const concealedSpeed: TendencyAxis = speedTerms.length
    ? { value: normalized(speedTerms), band: toBand(normalized(speedTerms)) }
    : null;

  return { offenseDefense, concealedSpeed };
}

export function toBand(value: number): 0 | 1 | 2 | 3 | 4 {
  if (value < -1.5) return 0;
  if (value < -0.5) return 1;
  if (value < 0.5) return 2;
  if (value < 1.5) return 3;
  return 4;
}
