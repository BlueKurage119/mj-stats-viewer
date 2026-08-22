/**
 * レーダー5軸（攻・守・速・制・運）。
 * 詳細: docs/design/issue-4-domain-logic.md §5.2
 */

import type { PlayerExtendedStats } from '../api';
import { deviationValue, type MetricDistribution } from './distribution';

export type RadarInput = Pick<PlayerExtendedStats, '打点效率' | '铳点损失' | '和牌率' | '立直率' | '里宝率' | '一发率'>;
export type RadarAxes = {
  攻: number | null;
  守: number | null;
  速: number | null;
  制: number | null;
  運: number | null;
};

export function calcRadar(stats: RadarInput, lookup: (metric: string) => MetricDistribution | null): RadarAxes {
  const dv = (metric: string, x: number): number | null => {
    const d = lookup(metric);
    return d ? deviationValue(x, d) : null;
  };

  const 攻 = dv('打点效率', stats.打点效率);
  const 铳点损失Dv = dv('铳点损失', stats.铳点损失);
  const 守 = 铳点损失Dv === null ? null : 100 - 铳点损失Dv;
  const 速 = dv('和牌率', stats.和牌率);
  const 制 = dv('立直率', stats.立直率);

  const 里宝Dist = lookup('里宝率');
  const 一发Dist = lookup('一发率');
  let 運: number | null = null;
  if (里宝Dist && 一发Dist) {
    const denom = 里宝Dist.mean + 一发Dist.mean;
    if (denom !== 0) {
      運 = (50 * (stats.里宝率 + stats.一发率)) / denom;
    }
  }

  return { 攻, 守, 速, 制, 運 };
}
