import { useState, type ReactElement } from 'react';
import globalHistogramFixture from '../domain/__fixtures__/global_histogram.json';
import levelStatsFixture from '../domain/__fixtures__/level_statistics.json';
import type { GameMode, GlobalHistogram, LevelStatistics } from '../api';
import { useTheme, type ColorModeSetting } from '../theme/ThemeProvider';
import { COMPARE_METRICS } from '../compare/compareMetrics';
import { HistogramCard } from '../compare/HistogramCard';
import { LevelDistributionCard } from '../compare/LevelDistributionCard';
import { buildLevelDistributionView } from '../compare/levelDistributionView';
import { CompareContextBar } from '../compare/CompareContextBar';
import { populationSize } from '../compare/histogramView';
import '../shell/shell.css';
import '../compare/compare.css';

const gh = globalHistogramFixture as unknown as GlobalHistogram;
const levelStats = levelStatsFixture as LevelStatistics;

const winRateMetric = COMPARE_METRICS.find((m) => m.key === 'winRate')!;
const dealInRateMetric = COMPARE_METRICS.find((m) => m.key === 'dealInRate')!;

export function CompareGallery(): ReactElement {
  const { modeSetting, setModeSetting } = useTheme();

  // 状態8のチップ切替インタラクション用
  const [activeMode, setActiveMode] = useState<GameMode>(16);

  const winHist = gh['16']['0']['和牌率'].histogramFull!;
  const dealInHist = gh['16']['0']['放铳率'].histogramFull!;

  // 段位分布ビュー
  const viewKetsu1 = buildLevelDistributionView({
    stats: levelStats,
    numPlayers: 4,
    selfLevelId: 10301, // 雀傑1
  });

  const viewKonten = buildLevelDistributionView({
    stats: levelStats,
    numPlayers: 4,
    selfLevelId: 10701, // 魂天1
  });

  const viewUnknown = buildLevelDistributionView({
    stats: levelStats,
    numPlayers: 4,
    selfLevelId: null,
  });

  const popN = populationSize(gh, 16);

  return (
    <div style={{ padding: '24px', maxWidth: '1040px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 className="md-typescale-headline-medium">Compare Gallery (#/__compare)</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
          <span>Theme:</span>
          {(['light', 'dark', 'system'] as ColorModeSetting[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setModeSetting(mode)}
              style={{
                fontWeight: modeSetting === mode ? 'bold' : 'normal',
                padding: '4px 12px',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* 状態 8: CompareContextBar */}
        <section>
          <h2 className="md-typescale-title-medium">
            8. CompareContextBar（候補1つ / 候補3つ / 期間フィルタ）
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p className="md-typescale-label-medium">8a. 候補1つ (全期間)</p>
              <CompareContextBar
                candidates={[16]}
                currentMode={16}
                populationSize={popN}
                period="all"
                onSelectMode={() => {}}
              />
            </div>
            <div>
              <p className="md-typescale-label-medium">8b. 候補3つ（チップ切替可）</p>
              <CompareContextBar
                candidates={[16, 12, 9]}
                currentMode={activeMode}
                populationSize={popN}
                period="all"
                onSelectMode={setActiveMode}
              />
            </div>
            <div>
              <p className="md-typescale-label-medium">8c. 期間フィルタ有り (30日)</p>
              <CompareContextBar
                candidates={[16, 12]}
                currentMode={16}
                populationSize={popN}
                period="30d"
                onSelectMode={() => {}}
              />
            </div>
          </div>
        </section>

        {/* 状態 7: LevelDistributionCard */}
        <section>
          <h2 className="md-typescale-title-medium">
            7. LevelDistributionCard（雀傑1 / 魂天 / 自分不明）
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p className="md-typescale-label-medium">7a. 自分＝雀傑1 (10301)</p>
              <LevelDistributionCard view={viewKetsu1} />
            </div>
            <div>
              <p className="md-typescale-label-medium">7b. 自分＝魂天 (10701 → 10799畳み込み)</p>
              <LevelDistributionCard view={viewKonten} />
            </div>
            <div>
              <p className="md-typescale-label-medium">7c. 自分不明 (selfLevelId: null)</p>
              <LevelDistributionCard view={viewUnknown} />
            </div>
          </div>
        </section>

        {/* 状態 1〜6: HistogramCard の各種縮退状態 */}
        <section>
          <h2 className="md-typescale-title-medium">1〜6. HistogramCard の各種状態</h2>
          <div className="compare-grid">
            {/* 状態 1: ready (和牌率) */}
            <div>
              <p className="md-typescale-label-medium">1. ready (和了率 higher)</p>
              <HistogramCard
                metric={winRateMetric}
                value={0.228}
                histogram={winHist}
                tableMean={0.2093}
                levelMean={0.215}
              />
            </div>

            {/* 状態 2: lowerIsBetter (放銃率 good トーン確認: A2-2) */}
            <div>
              <p className="md-typescale-label-medium">2. lowerIsBetter (放銃率 good確認)</p>
              <HistogramCard
                metric={dealInRateMetric}
                value={0.115}
                histogram={dealInHist}
                tableMean={0.1237}
                levelMean={0.12}
              />
            </div>

            {/* 状態 3: loading */}
            <div>
              <p className="md-typescale-label-medium">3. loading (スケルトン)</p>
              <HistogramCard
                metric={winRateMetric}
                value={null}
                histogram={null}
                tableMean={null}
                levelMean={null}
                loading={true}
              />
            </div>

            {/* 状態 4: histogram === null */}
            <div>
              <p className="md-typescale-label-medium">4. histogram === null (分布なし縮退)</p>
              <HistogramCard
                metric={winRateMetric}
                value={0.228}
                histogram={null}
                tableMean={null}
                levelMean={null}
              />
            </div>

            {/* 状態 5: マーカーがレンジ外 (A3-4) */}
            <div>
              <p className="md-typescale-label-medium">5. マーカーがレンジ外 (クランプ確認)</p>
              <HistogramCard
                metric={winRateMetric}
                value={1.5}
                histogram={winHist}
                tableMean={0.2093}
                levelMean={0.215}
              />
            </div>

            {/* 状態 6: 段位平均線なし */}
            <div>
              <p className="md-typescale-label-medium">6. 段位平均線なし (levelMean: null)</p>
              <HistogramCard
                metric={winRateMetric}
                value={0.228}
                histogram={winHist}
                tableMean={0.2093}
                levelMean={null}
              />
            </div>
          </div>
        </section>

        {/* スクロールテスト用の余白 (A7-2 sticky 確認用) */}
        <div style={{ height: '1000px', padding: '16px', background: 'transparent' }}>
          <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-outline)' }}>
            ↓ スクロールテスト用スペース（800px以上スクロールして sticky 動作を検証可能）
          </p>
        </div>
      </div>
    </div>
  );
}
