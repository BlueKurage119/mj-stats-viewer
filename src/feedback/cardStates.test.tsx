import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup as render} from 'react-dom/server';
import type {PlayerStats,PlayerExtendedStats,GlobalHistogram} from '../api';
import statsFixture from '../domain/__fixtures__/player_stats_4p.json';
import extendedFixture from '../api/testdata/player_extended_stats.json';
import histogramFixture from '../domain/__fixtures__/global_histogram.json';
import {normalizePlayerExtendedStats} from '../api/normalize';
import type {FilteredStatsState} from '../filters/useFilteredStats';
import {RankCard} from '../summary/RankCard';
import {KeyStatsCard} from '../summary/KeyStatsCard';
import {PlaystyleCard} from '../summary/PlaystyleCard';
import {HistogramCard} from '../compare/HistogramCard';
import {LevelDistributionCard} from '../compare/LevelDistributionCard';
import {COMPARE_METRICS} from '../compare/compareMetrics';
import {toRequestIssue} from './requestIssue';
const stats=statsFixture as PlayerStats;
const extended=normalizePlayerExtendedStats(extendedFixture) as PlayerExtendedStats;
const issue=toRequestIssue(new Error('fixture'));
const histogram=histogramFixture as GlobalHistogram;
const base:FilteredStatsState={kind:'ready',stats,extended,extendedState:{kind:'ready',data:extended}};
const errorDist={kind:'error',issue,message:issue.message} as const;
const metric=COMPARE_METRICS[0];
const dist=histogram['16']['0'][metric.histogramKey].histogramFull!;
describe('independent card regions',()=>{
  it('keeps rank values visible while details load, fail or are absent',()=>{
    const html=render(<RankCard state={base} numPlayers={4}/>);
    for(const ext of [{kind:'loading'},{kind:'error',issue,message:issue.message},{kind:'empty'}] as const){
      const state:FilteredStatsState={...base,extended:null,extendedState:ext};
      const next=render(<RankCard state={state} numPlayers={4}/>);
      expect(next.match(/data-testid="rank-legend"[\s\S]*?<\/ul>/)?.[0]).toBe(html.match(/data-testid="rank-legend"[\s\S]*?<\/ul>/)?.[0]);
      expect(next).toContain('data-state="ready"');
      expect(next).toContain(ext.kind==='loading'?'class="feedback-skeleton"':'—局');
    }
  });
  it('renders six self values without waiting for population data',()=>{
    for(const distribution of [{kind:'loading'} as const,errorDist]){
      const html=render(<KeyStatsCard state={base} distribution={distribution} modes={[16]} numPlayers={4}/>);
      expect(html).toContain('data-state="ready"');expect((html.match(/data-metric=/g)??[]).length).toBe(6);expect(html).toContain('45.4%');
    }
  });
  it('does not hide known playstyle errors behind another loading source',()=>{
    const extendedError:FilteredStatsState={...base,extended:null,extendedState:{kind:'error',issue,message:issue.message}};
    expect(render(<PlaystyleCard state={extendedError} distribution={{kind:'loading'}} modes={[16]} numPlayers={4}/>)).toContain('data-state="error"');
    expect(render(<PlaystyleCard state={{...base,extended:null,extendedState:{kind:'loading'}}} distribution={errorDist} modes={[16]} numPlayers={4}/>)).toContain('data-state="error"');
  });
  it('keeps self values visible while histogram is loading',()=>{
    const html=render(<HistogramCard metric={metric} value={.228} histogram={null} tableMean={null} levelMean={null} distributionLoading/>);
    expect(html).toContain('22.8%');expect(html).not.toContain('data-testid="top-percent"');
  });
  it('keeps distribution visible without a self value or while it loads',()=>{
    for(const valueLoading of [false,true]){
      const html=render(<HistogramCard metric={metric} value={null} histogram={dist} tableMean={.2} levelMean={null} valueLoading={valueLoading}/>);
      expect(html).toContain('<svg');expect(html).not.toContain('data-testid="top-percent"');
    }
  });
  it('finishes level distribution as error or empty without a skeleton',()=>{
    const error=render(<LevelDistributionCard view={null} issue={issue}/>);expect(error).toContain('data-state="error"');expect(error).not.toContain('histogram-card__skeleton');
    const empty=render(<LevelDistributionCard view={null}/>);expect(empty).toContain('data-state="empty"');expect(empty).not.toContain('histogram-card__skeleton');
  });
});
