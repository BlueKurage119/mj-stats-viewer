import { describe, it, expect } from 'vitest';
import { buildIdentityView, effectiveLevelPoint, toConditionLines, type ConditionLine } from './identityView';
import type { CurrentLevelInfo, LevelWithDelta } from '../api';
import { formatLevelWithDelta, getLevelTag, parseLevelId, preferredMode, type RankCondition } from '../domain';

/** ダミーの CurrentLevelInfo を組み立てる。nickname は実在プレイヤー名を使わない */
function makeInfo(level: LevelWithDelta, gameCount = 1234): CurrentLevelInfo {
  return {
    level,
    maxLevel: level,
    nickname: 'テストプレイヤー01',
    gameCount,
    playedModes: [],
  };
}

/** ConditionLine[] から rankLabel/threshold だけを取り出す（key の厳密値は仕様の対象外） */
function pluck(lines: readonly ConditionLine[]): { rankLabel: string; threshold: number | null }[] {
  return lines.map(({ rankLabel, threshold }) => ({ rankLabel, threshold }));
}

describe('identityView: buildIdentityView', () => {
  it('U1: 雀傑2 232/1400、条件は全 never', () => {
    const view = buildIdentityView(makeInfo({ id: 10302, score: 232, delta: 0 }));
    expect(view.badge).toEqual({ kind: 'stars', major: '雀傑', stars: 2 });
    expect(view.pointText).toBe('232');
    expect(view.maxPointText).toBe('1400');
    expect(view.remainingText).toBe('1168');
    expect(view.nextLevelText).toBe('雀傑3');
    expect(view.conditionMode).toBe(9);
    expect(view.promotions).toEqual([]);
    expect(view.demotions).toEqual([]);
  });

  it('U2: 上限超え（正規化で雀傑3 1000/2000 になる）', () => {
    const view = buildIdentityView(makeInfo({ id: 10302, score: 1400, delta: 0 }));
    expect(view.badge).toEqual({ kind: 'stars', major: '雀傑', stars: 3 });
    expect(view.pointText).toBe('1000');
    expect(view.maxPointText).toBe('2000');
    expect(view.promotions).toEqual([]);
  });

  it('U3: 負値（正規化前の levelId で preferredMode を呼ぶ退行を検知する）', () => {
    const view = buildIdentityView(makeInfo({ id: 10401, score: 10, delta: -100 }));
    expect(view.badge).toEqual({ kind: 'stars', major: '雀傑', stars: 3 });
    // 正規化前の 10401（玉）の preferredMode は 12。正規化後 10303（雀傑3・金）の preferredMode は 9。
    expect(view.conditionMode).toBe(9);
  });

  it('U4: 雀聖3、3位の到達不能閾値（79,100点）が落ちる', () => {
    const view = buildIdentityView(makeInfo({ id: 10503, score: 8950, delta: 0 }));
    expect(pluck(view.promotions)).toEqual([
      { rankLabel: '1位', threshold: null },
      { rankLabel: '2位', threshold: 9100 },
    ]);
  });

  it('U5: 雀豪1、降段側の閾値と無条件行', () => {
    const view = buildIdentityView(makeInfo({ id: 10401, score: 60, delta: -40 }));
    expect(pluck(view.demotions)).toEqual([
      { rankLabel: '3位', threshold: 9000 },
      { rankLabel: '4位', threshold: null },
    ]);
  });

  it('U6: 雀傑3 昇段目前、連続する無条件行の畳み込み', () => {
    const view = buildIdentityView(makeInfo({ id: 10303, score: 1950, delta: 40 }));
    expect(pluck(view.promotions)).toEqual([{ rankLabel: '2位以内', threshold: null }]);
  });

  it('U7: 三麻 雀豪1、1件しかないので畳まない', () => {
    const view = buildIdentityView(makeInfo({ id: 20401, score: 40, delta: 0 }));
    expect(pluck(view.demotions)).toEqual([{ rankLabel: '3位', threshold: null }]);
  });

  it('U8: 魂天1、小数表示と always/never のみの条件', () => {
    const view = buildIdentityView(makeInfo({ id: 10701, score: 1960, delta: 0 }));
    expect(view.badge).toEqual({ kind: 'plain', text: '魂天1' });
    expect(view.pointText).toBe('19.6');
    expect(view.maxPointText).toBe('20.0');
    expect(view.remainingText).toBe('0.4');
    expect(pluck(view.promotions)).toEqual([{ rankLabel: '1位', threshold: null }]);
  });

  it('U9: 魂天20、上限なし', () => {
    const view = buildIdentityView(makeInfo({ id: 10720, score: 5000, delta: 0 }));
    expect(view.maxPointText).toBeNull();
    expect(view.progress).toBeNull();
    expect(view.remainingText).toBeNull();
    expect(view.nextLevelText).toBeNull();
    expect(view.promotions).toEqual([]);
    expect(view.demotions).toEqual([]);
  });

  it('U10: 旧魂天（majorRank6）はバージョン補正後のスケールで表示する', () => {
    const view = buildIdentityView(makeInfo({ id: 10601, score: 1000, delta: 0 }));
    expect(view.badge).toEqual({ kind: 'plain', text: '魂天1' });
    expect(view.pointText).toBe('3.0');
  });

  it('U11: 雀士3、preferredMode が null なら条件は空。ただし残pt・次段位は出る', () => {
    const view = buildIdentityView(makeInfo({ id: 10203, score: 900, delta: 0 }));
    expect(view.conditionMode).toBeNull();
    expect(view.promotions).toEqual([]);
    expect(view.demotions).toEqual([]);
    expect(view.remainingText).toBe('100');
    expect(view.nextLevelText).toBe('雀傑1');
  });
});

describe('identityView: toConditionLines（到達可能性の境界。四麻 mode16 rank1: reachable=50000）', () => {
  it('U12: atLeast 50000 は残り、atLeast 50100 は落ちる', () => {
    const kept: RankCondition[] = [
      { rank: 0, kind: 'never' },
      { rank: 1, kind: 'atLeast', score: 50000 },
    ];
    const dropped: RankCondition[] = [
      { rank: 0, kind: 'never' },
      { rank: 1, kind: 'atLeast', score: 50100 },
    ];
    expect(pluck(toConditionLines(kept, 16, 'promotion'))).toEqual([{ rankLabel: '2位', threshold: 50000 }]);
    expect(pluck(toConditionLines(dropped, 16, 'promotion'))).toEqual([]);
  });

  it('U12: atMost 50000 は無条件行、atMost 49900 は閾値行', () => {
    const unconditional: RankCondition[] = [
      { rank: 0, kind: 'never' },
      { rank: 1, kind: 'atMost', score: 50000 },
    ];
    const threshold: RankCondition[] = [
      { rank: 0, kind: 'never' },
      { rank: 1, kind: 'atMost', score: 49900 },
    ];
    expect(pluck(toConditionLines(unconditional, 16, 'demotion'))).toEqual([{ rankLabel: '2位', threshold: null }]);
    expect(pluck(toConditionLines(threshold, 16, 'demotion'))).toEqual([{ rankLabel: '2位', threshold: 49900 }]);
  });
});

describe('identityView: effectiveLevelPoint と formatLevelWithDelta の整合', () => {
  const inputs: LevelWithDelta[] = [
    { id: 10302, score: 232, delta: 0 }, // U1
    { id: 10302, score: 1400, delta: 0 }, // U2
    { id: 10401, score: 10, delta: -100 }, // U3
    { id: 10503, score: 8950, delta: 0 }, // U4
    { id: 10401, score: 60, delta: -40 }, // U5
    { id: 10303, score: 1950, delta: 40 }, // U6
    { id: 20401, score: 40, delta: 0 }, // U7
    { id: 10701, score: 1960, delta: 0 }, // U8
    { id: 10720, score: 5000, delta: 0 }, // U9
    { id: 10601, score: 1000, delta: 0 }, // U10
    { id: 10203, score: 900, delta: 0 }, // U11
  ];

  it('U13: formatLevelWithDelta の先頭段位タグが effectiveLevelPoint の段位タグと一致する', () => {
    for (const lv of inputs) {
      const eff = effectiveLevelPoint(lv);
      const expectedTag = getLevelTag(parseLevelId(eff.levelId));
      const actualTag = formatLevelWithDelta(lv).split(' ')[0];
      expect(actualTag).toBe(expectedTag);
    }
  });
});

describe('identityView: preferredMode の半荘不変条件（U14）', () => {
  const HALF_MODES = new Set([16, 12, 9, 26, 24, 22]);

  it('LEVEL_ALLOWED_MODES が非空の levelId は必ず半荘モードを返す', () => {
    const levelIds: number[] = [];
    for (const numPlayerId of [1, 2]) {
      for (const majorRank of [3, 4, 5]) {
        for (const minorRank of [1, 2, 3]) {
          levelIds.push(numPlayerId * 10000 + majorRank * 100 + minorRank);
        }
      }
      levelIds.push(numPlayerId * 10000 + 700 + 1); // 魂天1（majorRank7）
    }

    expect(levelIds.length).toBe(20);
    for (const levelId of levelIds) {
      const mode = preferredMode(levelId);
      expect(mode).not.toBeNull();
      expect(HALF_MODES.has(mode!)).toBe(true);
    }
  });
});

/**
 * 再検収（2026-09-05）で「実装は正しいがテストの次元が欠けている」と指摘された分。
 * ミューテーションでは SURVIVED になるが、到達経路は実在する（降段の畳み込み）か、
 * ブラウザ実測でしか確認されていなかった（progress 等の受け渡し）。
 */
describe('buildIdentityView — 検収で指摘された未検証の次元', () => {
  it('U17: 降段側の連続する無条件行が畳まれる（魂天1・0pt で 3位以下）', () => {
    // 魂天1（10701）を 0pt にすると demotionConditions は [never, never, always, always] を返す。
    // 末尾から連続する always が2件なので 1行に畳まれ、ラベルは「3位以下」になる。
    const view = buildIdentityView(makeInfo({ id: 10701, score: 0, delta: 0 }));

    expect(view.conditionMode).not.toBeNull();
    expect(pluck(view.demotions)).toEqual([{ rankLabel: '3位以下', threshold: null }]);
  });

  it('U18: progress / pointText / maxPointText / remainingText / nextLevelText が上限ptから一貫して導かれる', () => {
    // 雀傑2（10302）は上限 1400pt。232pt なら残り 1168pt、進捗 232/1400。
    const view = buildIdentityView(makeInfo({ id: 10302, score: 232, delta: 0 }));

    expect(view.pointText).toBe('232');
    expect(view.maxPointText).toBe('1400');
    expect(view.remainingText).toBe('1168');
    expect(view.nextLevelText).toBe('雀傑3');
    expect(view.progress).toBeCloseTo(232 / 1400, 10);
  });

  it('U19: 上限ptが無い段位（魂天20）は progress と残pt 系がすべて null', () => {
    const view = buildIdentityView(makeInfo({ id: 10720, score: 5000, delta: 0 }));

    expect(view.maxPointText).toBeNull();
    expect(view.progress).toBeNull();
    expect(view.remainingText).toBeNull();
    expect(view.nextLevelText).toBeNull();
  });

  it('U20: nickname / gameCount / levelText が入力からそのまま運ばれる', () => {
    const view = buildIdentityView(makeInfo({ id: 10302, score: 232, delta: 0 }, 4321));

    expect(view.nickname).toBe('テストプレイヤー01');
    expect(view.gameCount).toBe(4321);
    expect(view.levelText).toBe('雀傑2');
  });
});
