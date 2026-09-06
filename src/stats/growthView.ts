import type { GameMode, LevelWithDelta } from '../api';
import { MODE_LABELS } from '../filters/filterState';
import {
  expectedPointPerGame,
  formatAdjustedScore,
  gamesToDemotion,
  gamesToPromotion,
  getLevelMajorTag,
  getLevelTagFromId,
  parseLevelId,
  preferredMode,
  projectAfterGames,
  splitStableLevelNumber,
  estimateStableLevel2,
  type StableLevel,
} from '../domain';
import { effectiveLevelPoint } from '../summary/identityView';
import type { StatRow } from './statsView';

export const PROJECTION_GAMES = 50;

export interface GrowthInput {
  readonly level: LevelWithDelta; // useCurrentIdentity 由来（フィルタ非依存）
  readonly rankRates: readonly number[];
  readonly rankAvgScores: readonly number[];
  readonly numPlayers: 3 | 4;
  readonly selectedModeCount: number; // §3.5 の注記判定
  readonly selectedModes: readonly GameMode[]; // 同上
  readonly maxLevel: LevelWithDelta | null; // PlayerStats.max_level（フィルタ依存・§3.2）
}

export interface GrowthView {
  readonly mode: GameMode | null; // 基準卓。null なら全行 '—'
  readonly note: string | null; // §3.5 の注記
  readonly rows: readonly StatRow[]; // 常に5行（§3.2 の順）
  readonly expectedPoint: number | null; // テスト・#4 との突き合わせ用に生値も返す
}

function modeMeta(mode: GameMode | null): { label: string; length: string } | null {
  if (mode === null) return null;
  const label = MODE_LABELS[mode];
  if (!label) return null;
  const length = label.endsWith('東') ? '東風' : '半荘';
  return { label, length };
}

function buildGrowthModeNote(
  mode: GameMode | null,
  selectedModeCount: number,
  selectedModes: readonly GameMode[],
): string | null {
  if (mode === null) return null;
  const needNote =
    selectedModeCount >= 2 || (selectedModeCount === 1 && selectedModes[0] !== mode);
  if (!needNote) return null;

  const meta = modeMeta(mode);
  if (!meta) return null;
  return `複数モードを選択中です。段位pt の計算は${meta.label}の間・${meta.length}を基準にしています。`;
}

function formatStableLevel(st: StableLevel): string {
  switch (st.kind) {
    case 'number':
      return splitStableLevelNumber(st.value).text;
    case 'level': {
      const base = getLevelTagFromId(st.levelId);
      if (st.bound === 'plus') return `${base}+`;
      if (st.bound === 'minus') return `${base}\u2212`;
      return base;
    }
    case 'konten': {
      const level = parseLevelId(st.levelId);
      const major = getLevelMajorTag(level);
      return `${major}+`;
    }
    case 'unavailable':
      return '—';
  }
}

function formatMaxLevel(maxLevel: LevelWithDelta | null): string {
  if (!maxLevel || !maxLevel.id) return '—';
  try {
    return getLevelTagFromId(maxLevel.id);
  } catch {
    return '—';
  }
}

/** §3.4 のガードをすべて内包する。throw しない */
export function buildGrowthView(input: GrowthInput): GrowthView {
  let eff;
  let effLevel;
  try {
    eff = effectiveLevelPoint(input.level);
    effLevel = parseLevelId(eff.levelId);
  } catch {
    eff = null;
    effLevel = null;
  }

  const mode = eff ? preferredMode(eff.levelId) : null;
  const meta = modeMeta(mode);
  const note = buildGrowthModeNote(mode, input.selectedModeCount, input.selectedModes);

  // §3.4 ガード判定
  const guardPass =
    eff !== null &&
    effLevel !== null &&
    mode !== null &&
    input.rankRates.length === input.rankAvgScores.length &&
    input.rankRates.length === input.numPlayers &&
    input.rankRates.length > 0 &&
    input.rankRates.every((r) => typeof r === 'number' && Number.isFinite(r)) &&
    input.rankAvgScores.every((s) => typeof s === 'number' && Number.isFinite(s));

  let expectedPoint: number | null = null;
  let gamesToBoundaryVal: number | null = null;
  let gamesToBoundaryLabel = '昇降段まで';
  let projVal: { levelId: number; point: number } | null = null;
  let stableLevelVal: StableLevel = { kind: 'unavailable' };

  if (guardPass && mode !== null && eff !== null && effLevel !== null) {
    expectedPoint = expectedPointPerGame(
      input.rankRates,
      input.rankAvgScores,
      mode,
      effLevel,
    );

    if (Number.isFinite(expectedPoint)) {
      if (expectedPoint > 0) {
        gamesToBoundaryLabel = '昇段まで';
        gamesToBoundaryVal = gamesToPromotion(eff, expectedPoint);
      } else if (expectedPoint < 0) {
        gamesToBoundaryLabel = '降段まで';
        gamesToBoundaryVal = gamesToDemotion(eff, expectedPoint);
      } else {
        gamesToBoundaryLabel = '昇降段まで';
        gamesToBoundaryVal = null;
      }

      projVal = projectAfterGames(eff, expectedPoint, PROJECTION_GAMES);
    }

    // estimateStableLevel2 には eff ではなく生の input.level を渡す（A3-5）
    stableLevelVal = estimateStableLevel2(
      {
        levelId: input.level.id,
        score: input.level.score,
        delta: input.level.delta,
        rankRates: input.rankRates,
        rankAvgScores: input.rankAvgScores,
      },
      mode,
    );
  }

  // 1. 段位pt期待値
  const expectedPointText =
    expectedPoint !== null && Number.isFinite(expectedPoint)
      ? `${expectedPoint < 0 ? '\u2212' : ''}${Math.abs(expectedPoint).toFixed(2)}pt/戦`
      : '—';
  const expectedPointNote = meta ? `${meta.label}の間・${meta.length}基準` : '';

  // 2. 昇段まで / 降段まで / 昇降段まで
  const gamesToBoundaryText =
    gamesToBoundaryVal !== null && Number.isFinite(gamesToBoundaryVal)
      ? `${gamesToBoundaryVal}戦`
      : '—';
  const gamesToBoundaryNote =
    eff !== null && effLevel !== null
      ? `現在 ${formatAdjustedScore(effLevel, eff.point)}`
      : '';

  // 3. 50戦後の見込み
  let projection50Text = '—';
  if (projVal !== null) {
    try {
      const projLevel = parseLevelId(projVal.levelId);
      projection50Text = `${getLevelTagFromId(projVal.levelId)} ${formatAdjustedScore(projLevel, projVal.point)}`;
    } catch {
      projection50Text = '—';
    }
  }
  const projection50Note = meta
    ? `${meta.label}の間・${meta.length}を${PROJECTION_GAMES}戦打った場合`
    : '';

  // 4. 安定段位
  const stableLevelText = formatStableLevel(stableLevelVal);
  const stableLevelNote = meta ? `${meta.label}の間・${meta.length}基準` : '';

  // 5. 最高段位
  const maxLevelText = formatMaxLevel(input.maxLevel);
  const maxLevelNote = '選択中の期間・モードで到達した最高段位';

  const rows: readonly StatRow[] = [
    {
      key: 'expectedPoint',
      label: '段位pt期待値',
      valueText: expectedPointText,
      note: expectedPointNote,
    },
    {
      key: 'gamesToBoundary',
      label: gamesToBoundaryLabel,
      valueText: gamesToBoundaryText,
      note: gamesToBoundaryNote,
    },
    {
      key: 'projection50',
      label: `${PROJECTION_GAMES}戦後の見込み`,
      valueText: projection50Text,
      note: projection50Note,
    },
    {
      key: 'stableLevel',
      label: '安定段位',
      valueText: stableLevelText,
      note: stableLevelNote,
    },
    {
      key: 'maxLevel',
      label: '最高段位',
      valueText: maxLevelText,
      note: maxLevelNote,
    },
  ];

  return {
    mode,
    note,
    rows,
    expectedPoint,
  };
}
