import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HistogramCard } from './HistogramCard';
import { COMPARE_METRICS } from './compareMetrics';
import globalHistogramFixture from '../domain/__fixtures__/global_histogram.json';
import type { GlobalHistogram } from '../api';

const gh = globalHistogramFixture as unknown as GlobalHistogram;
const winRateMetric = COMPARE_METRICS.find((m) => m.key === 'winRate')!;
const winRateHist = gh['16']['0']['和牌率'].histogramFull!;

describe('HistogramCard', () => {
  it('renders value and both table/level mean notes when provided', () => {
    const html = renderToStaticMarkup(
      <HistogramCard
        metric={winRateMetric}
        value={0.228}
        histogram={winRateHist}
        tableMean={0.209}
        levelMean={0.215}
      />
    );

    expect(html).toContain('histogram-card__value');
    expect(html).toContain('22.8%');
    expect(html).toContain('histogram-card__mean-note');
    expect(html).toContain('卓平均 20.9%　段位平均 21.5%');
  });

  it('renders only tableMean when levelMean is null', () => {
    const html = renderToStaticMarkup(
      <HistogramCard
        metric={winRateMetric}
        value={0.228}
        histogram={winRateHist}
        tableMean={0.209}
        levelMean={null}
      />
    );

    expect(html).toContain('histogram-card__mean-note');
    expect(html).toContain('卓平均 20.9%');
    expect(html).not.toContain('段位平均');
  });

  it('renders only levelMean when tableMean is null', () => {
    const html = renderToStaticMarkup(
      <HistogramCard
        metric={winRateMetric}
        value={0.228}
        histogram={winRateHist}
        tableMean={null}
        levelMean={0.215}
      />
    );

    expect(html).toContain('histogram-card__mean-note');
    expect(html).toContain('段位平均 21.5%');
    expect(html).not.toContain('卓平均');
  });

  it('does not render mean-note element when both means are null', () => {
    const html = renderToStaticMarkup(
      <HistogramCard
        metric={winRateMetric}
        value={0.228}
        histogram={winRateHist}
        tableMean={null}
        levelMean={null}
      />
    );

    expect(html).not.toContain('histogram-card__mean-note');
  });

  it('renders dual skeletons in value-row when loading is true', () => {
    const html = renderToStaticMarkup(
      <HistogramCard
        metric={winRateMetric}
        value={null}
        histogram={null}
        tableMean={null}
        levelMean={null}
        loading={true}
      />
    );

    expect(html).toContain('data-state="loading"');
    // value-row のスケルトン（80px と 100px）が含まれていること
    expect(html).toContain('width:80px');
    expect(html).toContain('width:100px');
  });
});
