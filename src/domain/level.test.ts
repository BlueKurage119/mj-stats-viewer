import { describe, it, expect } from 'vitest';
import {
  formatLevelWithDelta,
  getLevelTagFromId,
  getMaxPoint,
  getNextLevel,
  getPenaltyPoint,
  getPreviousLevel,
  getScoreDisplay,
  isAllowedMode,
  parseLevelId,
  toLevelId,
} from './level';

describe('level: タグ', () => {
  it('getLevelTagFromId: 通常段位', () => {
    expect(getLevelTagFromId(20302)).toBe('雀傑2');
    expect(getLevelTagFromId(10101)).toBe('初心1');
  });

  it('getLevelTagFromId: 旧魂天は数字なし、現行魂天は数字あり', () => {
    expect(getLevelTagFromId(10601)).toBe('魂天');
    expect(getLevelTagFromId(10703)).toBe('魂天3');
  });
});

describe('level: 上限pt', () => {
  it('通常段位', () => {
    expect(getMaxPoint(parseLevelId(20302))).toBe(1400);
    expect(getMaxPoint(parseLevelId(10501))).toBe(4000);
  });

  it('魂天', () => {
    expect(getMaxPoint(parseLevelId(10701))).toBe(2000);
    expect(getMaxPoint(parseLevelId(10720))).toBe(0);
  });
});

describe('level: 表示整形', () => {
  it('formatLevelWithDelta: Issue 本文の実測値', () => {
    expect(formatLevelWithDelta({ id: 20302, score: 58, delta: 174 })).toBe('雀傑2 232/1400');
  });

  it('getScoreDisplay: 魂天のポイント表示', () => {
    expect(getScoreDisplay(parseLevelId(10601), 6871)).toBe('8.9');
    expect(getScoreDisplay(parseLevelId(10701), 6871)).toBe('68.7');
  });
});

describe('level: 遷移', () => {
  it('getNextLevel: 雀聖3 → 魂天1（majorRank 6 を飛ばす）', () => {
    expect(toLevelId(getNextLevel(parseLevelId(10503)))).toBe(10701);
  });

  it('getPreviousLevel: 魂天1 → 雀聖3（majorRank 6 を飛ばす）', () => {
    expect(toLevelId(getPreviousLevel(parseLevelId(10701)))).toBe(10503);
  });

  it('getPreviousLevel: 初心1 は自分自身を返す', () => {
    expect(toLevelId(getPreviousLevel(parseLevelId(10101)))).toBe(10101);
  });
});

describe('level: ラスペナ', () => {
  it('三麻モード', () => {
    expect(getPenaltyPoint(parseLevelId(20302), 22)).toBe(100); // LEVEL_PENALTY_3[7]
    expect(getPenaltyPoint(parseLevelId(20302), 21)).toBe(50); // LEVEL_PENALTY_E_3[7]
  });

  it('四麻モード', () => {
    expect(getPenaltyPoint(parseLevelId(10501), 16)).toBe(210);
  });
});

describe('level: 入室可否', () => {
  it('雀豪は王座に入れないが玉には入れる', () => {
    expect(isAllowedMode(parseLevelId(10401), 16)).toBe(false);
    expect(isAllowedMode(parseLevelId(10401), 12)).toBe(true);
  });
});
