import { describe, expect, it } from 'vitest';
import globalHistogramFixture from '../domain/__fixtures__/global_histogram.json';
import extendedStatsFixture from '../domain/__fixtures__/extended_stats_4p.json';
import { percentile } from '../domain/distribution';
import type { GlobalHistogram, HistogramData } from '../api';
import {
  buildHistogramPath,
  cropHistogram,
  formatMeanNote,
  formatMetricValue,
  getLevelBandMean,
  getMarkerPosition,
  populationSize,
  toTopPercent,
} from './histogramView';

const gh = globalHistogramFixture as unknown as GlobalHistogram;
const ext = extendedStatsFixture as Record<string, number>;

describe('histogramView', () => {
  describe('toTopPercent & percentile verification (A1-1)', () => {
    const cases: Array<{
      key: string;
      statsKey: string;
      direction: 'higher' | 'lower' | 'neutral';
      expectedPercentile: number;
      expectedText: string;
    }> = [
      { key: '和牌率', statsKey: '和牌率', direction: 'higher', expectedPercentile: 0.781633, expectedText: '上位 21.8%' },
      { key: '放铳率', statsKey: '放铳率', direction: 'lower', expectedPercentile: 0.352436, expectedText: '上位 35.2%' },
      { key: '立直率', statsKey: '立直率', direction: 'neutral', expectedPercentile: 0.806861, expectedText: '上位 19.3%' },
      { key: '副露率', statsKey: '副露率', direction: 'neutral', expectedPercentile: 0.333982, expectedText: '上位 66.6%' },
      { key: '默听率', statsKey: '默听率', direction: 'neutral', expectedPercentile: 0.34423, expectedText: '上位 65.6%' },
      { key: '打点效率', statsKey: '打点效率', direction: 'higher', expectedPercentile: 0.76277, expectedText: '上位 23.7%' },
      { key: '铳点损失', statsKey: '铳点损失', direction: 'lower', expectedPercentile: 0.353026, expectedText: '上位 35.3%' },
      { key: '和了巡数', statsKey: '和了巡数', direction: 'lower', expectedPercentile: 0.327016, expectedText: '上位 32.7%' },
      { key: '里宝率', statsKey: '里宝率', direction: 'higher', expectedPercentile: 0.665632, expectedText: '上位 33.4%' },
      { key: '一发率', statsKey: '一发率', direction: 'higher', expectedPercentile: 0.663864, expectedText: '上位 33.6%' },
    ];

    for (const c of cases) {
      it(`computes top percent for ${c.key} correctly`, () => {
        const hist = gh['16']['0'][c.key]?.histogramFull;
        expect(hist).toBeDefined();
        const value = ext[c.statsKey];
        expect(value).toBeDefined();

        const p = percentile(value, hist!);
        expect(p).toBeCloseTo(c.expectedPercentile, 4);

        const top = toTopPercent(p, c.direction);
        expect(top.text).toBe(c.expectedText);
      });
    }

    it('formats extreme percentiles correctly', () => {
      expect(toTopPercent(0.99999, 'higher').text).toBe('上位 0.1%未満');
      expect(toTopPercent(0.00001, 'higher').text).toBe('上位 99.9%超');
      expect(toTopPercent(0.00001, 'lower').text).toBe('上位 0.1%未満');
      expect(toTopPercent(0.99999, 'lower').text).toBe('上位 99.9%超');
    });

    it('assigns tone according to direction (R-2)', () => {
      // neutral is always neutral tone
      expect(toTopPercent(0.9, 'neutral').tone).toBe('neutral');
      expect(toTopPercent(0.1, 'neutral').tone).toBe('neutral');

      // higher: ratio <= 0.5 is good
      expect(toTopPercent(0.7, 'higher').tone).toBe('good');
      expect(toTopPercent(0.3, 'higher').tone).toBe('bad');

      // lower: ratio <= 0.5 is good (i.e. percentile <= 0.5)
      expect(toTopPercent(0.3, 'lower').tone).toBe('good');
      expect(toTopPercent(0.7, 'lower').tone).toBe('bad');
    });
  });

  describe('cropHistogram (A3-1, A3-3)', () => {
    it('reproduces crop windows in §1.3 (A3-1)', () => {
      const winEfficiencyHist = gh['16']['0']['打点效率'].histogramFull!;
      const winCrop = cropHistogram(winEfficiencyHist);
      expect(winCrop).not.toBeNull();
      expect(winCrop!.xMin).toBeCloseTo(600, 1);
      expect(winCrop!.xMax).toBeCloseTo(1900, 1);

      const winTurnHist = gh['16']['0']['和了巡数'].histogramFull!;
      const turnCrop = cropHistogram(winTurnHist);
      expect(turnCrop).not.toBeNull();
      expect(turnCrop!.xMin).toBeCloseTo(9.6, 2);
      expect(turnCrop!.xMax).toBeCloseTo(12.8, 2);
    });

    it('expands window when mark is outside crop window but inside [min, max] (A3-3)', () => {
      const winRateHist = gh['16']['0']['和牌率'].histogramFull!;
      const baseCrop = cropHistogram(winRateHist);
      expect(baseCrop!.xMax).toBeLessThan(0.45);

      const expandedCrop = cropHistogram(winRateHist, [0.45]);
      expect(expandedCrop!.xMax).toBeGreaterThanOrEqual(0.45);
    });

    it('does not expand window when mark is completely outside [min, max]', () => {
      const winRateHist = gh['16']['0']['和牌率'].histogramFull!;
      const baseCrop = cropHistogram(winRateHist);
      const outerCrop = cropHistogram(winRateHist, [1.5, -0.2]);
      expect(outerCrop!.xMin).toBeCloseTo(baseCrop!.xMin, 4);
      expect(outerCrop!.xMax).toBeCloseTo(baseCrop!.xMax, 4);
    });

    it('handles empty or zero total histogram gracefully', () => {
      const emptyHist: HistogramData = { min: 0, max: 1, bins: [] };
      expect(cropHistogram(emptyHist)).toBeNull();

      const zeroHist: HistogramData = { min: 0, max: 1, bins: [0, 0, 0] };
      expect(cropHistogram(zeroHist)).toBeNull();
    });

    it('ensures at least 3 bins width', () => {
      const singleBin: HistogramData = { min: 0, max: 10, bins: [0, 0, 100, 0, 0] };
      const res = cropHistogram(singleBin);
      expect(res).not.toBeNull();
      expect(res!.hi - res!.lo + 1).toBeGreaterThanOrEqual(3);
    });
  });

  describe('formatMetricValue', () => {
    it('formats rates with 1 decimal place and %', () => {
      expect(formatMetricValue(0.2284, 'rate')).toBe('22.8%');
      expect(formatMetricValue(0.2286, 'rate')).toBe('22.9%');
    });

    it('formats points with locale separators and minus sign', () => {
      expect(formatMetricValue(1380, 'point')).toBe('1,380');
      expect(formatMetricValue(-450, 'point')).toBe('\u2212450');
    });

    it('formats turns with 2 decimal places and 巡', () => {
      expect(formatMetricValue(11, 'turn')).toBe('11.00巡');
      expect(formatMetricValue(11.234, 'turn')).toBe('11.23巡');
    });

    it('returns dash for null/undefined/NaN', () => {
      expect(formatMetricValue(null, 'rate')).toBe('—');
      expect(formatMetricValue(undefined, 'point')).toBe('—');
      expect(formatMetricValue(NaN, 'turn')).toBe('—');
    });
  });

  describe('formatMeanNote', () => {
    it('formats both tableMean and levelMean when provided', () => {
      const text = formatMeanNote(0.209, 0.215, 'rate');
      expect(text).toBe('卓平均 20.9%　段位平均 21.5%');
    });

    it('formats only tableMean when levelMean is null or undefined', () => {
      expect(formatMeanNote(0.209, null, 'rate')).toBe('卓平均 20.9%');
      expect(formatMeanNote(0.209, undefined, 'rate')).toBe('卓平均 20.9%');
    });

    it('formats only levelMean when tableMean is null or undefined', () => {
      expect(formatMeanNote(null, 0.215, 'rate')).toBe('段位平均 21.5%');
      expect(formatMeanNote(undefined, 0.215, 'rate')).toBe('段位平均 21.5%');
    });

    it('returns null when both are null or undefined or invalid', () => {
      expect(formatMeanNote(null, null, 'rate')).toBeNull();
      expect(formatMeanNote(undefined, undefined, 'rate')).toBeNull();
      expect(formatMeanNote(NaN, null, 'rate')).toBeNull();
      expect(formatMeanNote(null, Infinity, 'rate')).toBeNull();
    });

    it('supports point and turn units correctly', () => {
      expect(formatMeanNote(1500, 1600, 'point')).toBe('卓平均 1,500　段位平均 1,600');
      expect(formatMeanNote(11.2, 11.5, 'turn')).toBe('卓平均 11.20巡　段位平均 11.50巡');
    });
  });

  describe('buildHistogramPath', () => {
    it('generates a valid SVG path d string with overshoot headroom', () => {
      const winRateHist = gh['16']['0']['和牌率'].histogramFull!;
      const winCrop = cropHistogram(winRateHist)!;
      const d = buildHistogramPath(winRateHist, winCrop);
      expect(d.startsWith('M 0,80')).toBe(true);
      expect(d.endsWith('L 320,80 Z')).toBe(true);
      // 最頻値の上端は y = HISTOGRAM_MARKER_OVERSHOOT (8.00) に達する
      expect(d.includes(',8.00')).toBe(true);
    });
  });

  describe('getMarkerPosition', () => {
    it('calculates x within 0..320 for values inside window', () => {
      const winTurnHist = gh['16']['0']['和了巡数'].histogramFull!;
      const crop = cropHistogram(winTurnHist)!;
      const pos = getMarkerPosition(11, winTurnHist, crop);
      expect(pos).not.toBeNull();
      expect(pos!.clamped).toBeNull();
      expect(pos!.x).toBeGreaterThan(0);
      expect(pos!.x).toBeLessThan(320);
    });

    it('clamps markers outside [min, max]', () => {
      const winRateHist = gh['16']['0']['和牌率'].histogramFull!;
      const crop = cropHistogram(winRateHist)!;
      const posLow = getMarkerPosition(-0.1, winRateHist, crop);
      expect(posLow).toEqual({ x: 0, clamped: 'low' });

      const posHigh = getMarkerPosition(1.5, winRateHist, crop);
      expect(posHigh).toEqual({ x: 320, clamped: 'high' });
    });
  });

  describe('populationSize', () => {
    it('calculates total population from histogram', () => {
      const pop = populationSize(gh, 16);
      expect(pop).toBeGreaterThan(990000);
      expect(pop).toBeLessThan(1010000);
    });
  });

  describe('getLevelBandMean', () => {
    it('resolves exact level band mean', () => {
      const mean = getLevelBandMean(gh, 16, 10503, '和牌率');
      expect(mean).toBe(0.215);
    });

    it('falls back to 10799 for konten levelId', () => {
      // 10701 -> konten fallback
      // gh fixture has no 10799 currently in mode 16, so returns null unless added
      expect(getLevelBandMean(gh, 16, 10701, '和牌率')).toBeNull();
    });

    it('returns null when mode or levelId does not exist', () => {
      expect(getLevelBandMean(gh, 16, 10101, '和牌率')).toBeNull();
    });
  });
});
