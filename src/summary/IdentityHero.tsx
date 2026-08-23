/**
 * Issue 8: IdentityHero — hero 領域のアイデンティティ表示。
 *
 * PlayerLayout から LayeredSheet の hero prop に渡す。
 * グローバルフィルタの影響を受けない（identity は useCurrentIdentity 由来のみ）。
 * stats.stats.level は絶対に使わないこと（要件 §5.3・設計書 §0-2）。
 *
 * 要件: docs/requirements.md §4.1・§5.3・§6.4・§6.6
 * 設計: docs/design/issue-8-identity-card.md
 * UI検証: docs/ui-verification/2026-08-24-issue-8-identity.md
 *   V1 修正: 段位タグと pt の重複を解消。段位タグ（大）のみ表示し、横に pt 数値（232/1400形式）を並べる。
 *   S1 反映: ニックネームをより大きく（headline-medium）に。段位ptプログレスバーを追加。
 */

import type { ReactElement, ReactNode } from 'react';
import type { CurrentIdentityState } from '../filters/useCurrentIdentity';
import type { GameMode, LevelWithDelta } from '../api';
import {
  getLevelTagFromId,
  formatAdjustedScore,
  currentPoint,
  getMaxPoint,
  getVersionAdjustedLevel,
  getVersionAdjustedScore,
  parseLevelId,
} from '../domain/level';
import { promotionConditions, demotionConditions, type RankCondition } from '../domain/transitions';
import { preferredMode } from '../domain/growth';
import { numPlayersForMode } from '../domain/levelConstants';
import './summary.css';

// ────────────────────────────────────────────────────
// 昇降条件の文言生成
// ────────────────────────────────────────────────────

function rankLabel(rank: number, numPlayers: 3 | 4): string {
  const labels4 = ['1位', '2位', '3位', '4位'];
  const labels3 = ['1位', '2位', '3位'];
  const table = numPlayers === 4 ? labels4 : labels3;
  return table[rank] ?? `${rank + 1}位`;
}

function formatScore(score: number): string {
  return score.toLocaleString('ja-JP');
}

/** RankCondition を人間可読な文字列に変換する。'never' は null（非表示） */
function conditionText(cond: RankCondition, numPlayers: 3 | 4): string | null {
  const rl = rankLabel(cond.rank, numPlayers);
  switch (cond.kind) {
    case 'always':
      return rl;
    case 'never':
      return null;
    case 'atLeast':
      return `${rl} ${formatScore(cond.score)}点以上`;
    case 'atMost':
      return `${rl} ${formatScore(cond.score)}点以下`;
  }
}

// ────────────────────────────────────────────────────
// 昇降条件バッジ（サブコンポーネント）
// ────────────────────────────────────────────────────

interface ConditionBadgeProps {
  label: string;
  items: string[];
  kind: 'promotion' | 'demotion';
}

function ConditionBadge({ label, items, kind }: ConditionBadgeProps): ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div
      className={`identity-conditions identity-conditions--${kind}`}
      aria-label={`${label}条件`}
    >
      <span className="identity-conditions__label md-typescale-label-small">{label}</span>
      <ul className="identity-conditions__list">
        {items.map((item) => (
          <li key={item} className="identity-conditions__item md-typescale-label-medium">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ────────────────────────────────────────────────────
// 段位ポイント プログレスバー
// ────────────────────────────────────────────────────

interface PtProgressBarProps {
  /** 現在ポイント（version補正済み） */
  point: number;
  /** 上限ポイント（0 = 上限なし） */
  maxPoint: number;
}

function PtProgressBar({ point, maxPoint }: PtProgressBarProps): ReactElement | null {
  if (maxPoint === 0) return null; // 魂天20: 上限なし
  const pct = Math.min(100, Math.max(0, (point / maxPoint) * 100));
  return (
    <div
      className="identity-hero__pt-progress"
      role="progressbar"
      aria-valuenow={point}
      aria-valuemin={0}
      aria-valuemax={maxPoint}
      aria-label={`段位ポイント: ${point} / ${maxPoint}`}
    >
      <div
        className="identity-hero__pt-progress-fill"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────
// ローディング状態
// ────────────────────────────────────────────────────

function IdentityHeroLoading(): ReactElement {
  return (
    <div className="identity-hero identity-hero--loading" aria-busy="true" data-testid="identity-hero">
      <div className="identity-hero__skeleton identity-hero__skeleton--title" />
      <div className="identity-hero__skeleton identity-hero__skeleton--level" />
      <div className="identity-hero__skeleton identity-hero__skeleton--pt" />
    </div>
  );
}

// ────────────────────────────────────────────────────
// エラー状態
// ────────────────────────────────────────────────────

function IdentityHeroError({ message }: { message: string }): ReactElement {
  return (
    <div className="identity-hero" data-testid="identity-hero">
      <p
        className="md-typescale-body-medium"
        role="alert"
        style={{ color: 'var(--md-sys-color-error)' }}
      >
        {message}
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────
// notFound 状態
// ────────────────────────────────────────────────────

function IdentityHeroNotFound(): ReactElement {
  return (
    <div className="identity-hero" data-testid="identity-hero">
      <p className="md-typescale-body-medium" role="alert">
        プレイヤーが見つかりませんでした
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────
// ready 状態（メイン表示）
// ────────────────────────────────────────────────────

interface IdentityHeroReadyProps {
  lv: LevelWithDelta;
  nickname: string;
}

function IdentityHeroReady({ lv, nickname }: IdentityHeroReadyProps): ReactElement {
  const level = parseLevelId(lv.id);
  const adjustedLevel = getVersionAdjustedLevel(level);
  const maxPoint = getMaxPoint(adjustedLevel);
  // pt 数値（'232/1400' 形式）— getLevelTag は含まない（段位タグは別に大きく表示するため）
  const point = getVersionAdjustedScore(level, currentPoint(lv));
  const ptText = formatAdjustedScore(adjustedLevel, point);
  const levelTag = getLevelTagFromId(lv.id);
  const mode: GameMode | null = preferredMode(lv.id);

  // 昇降条件（入れる最上の卓・半荘がある段位のみ）
  let promoItems: string[] = [];
  let demoItems: string[] = [];
  if (mode !== null) {
    const numPlayers = (numPlayersForMode(mode) as 3 | 4);
    promoItems = promotionConditions(lv, mode)
      .map((c) => conditionText(c, numPlayers))
      .filter((t): t is string => t !== null);
    demoItems = demotionConditions(lv, mode)
      .map((c) => conditionText(c, numPlayers))
      .filter((t): t is string => t !== null);
  }

  const hasConditions = promoItems.length > 0 || demoItems.length > 0;

  return (
    <div className="identity-hero" data-testid="identity-hero">
      {/* プレイヤー名（S1 反映: headline-medium で大きく） */}
      <h1
        className="identity-hero__nickname md-typescale-headline-medium"
        data-testid="identity-nickname"
      >
        {nickname}
      </h1>

      {/* 段位タグ（Display Small）と pt 数値（Headline Large）を横並び */}
      <div className="identity-hero__level-row">
        <span
          className="identity-hero__level-tag md-typescale-display-small"
          data-testid="identity-level-tag"
          aria-hidden="true"
        >
          {levelTag}
        </span>
        {/* data-testid="identity-level" は issue-6 C5 の検証で使われるため必ず維持する */}
        <span
          className="identity-hero__pt md-typescale-headline-large"
          data-testid="identity-level"
          aria-label={`段位ポイント: ${levelTag} ${ptText}`}
        >
          {ptText}
        </span>
      </div>

      {/* 段位ポイント プログレスバー（S1 反映） */}
      {mode !== null && (
        <PtProgressBar point={point} maxPoint={maxPoint} />
      )}

      {/* 昇降条件（成立するものだけ表示） */}
      {hasConditions && (
        <div className="identity-conditions-area" data-testid="identity-conditions">
          <ConditionBadge label="昇格" items={promoItems} kind="promotion" />
          <ConditionBadge label="降格" items={demoItems} kind="demotion" />
        </div>
      )}

      {/* 順位グラフ枠（承諾後に差し替えるプレースホルダ。V4: 将来ヒーロー背景として実装予定） */}
      <div
        className="identity-hero__rank-graph"
        data-testid="identity-rank-graph"
        role="img"
        aria-label="順位グラフ（承諾後実装）"
      >
        <span className="md-typescale-label-small">順位グラフ（近日実装予定）</span>
      </div>

      {/* スクリーンリーダー向け補足 */}
      <p className="visually-hidden">
        段位: {levelTag}、段位ポイント: {ptText}
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────
// 公開コンポーネント
// ────────────────────────────────────────────────────

export interface IdentityHeroProps {
  identity: CurrentIdentityState;
  /** FilterBar を受け取って hero 下部に描画する */
  filterBar: ReactNode;
}

/**
 * hero 領域のアイデンティティ表示。
 * PlayerLayout から LayeredSheet の hero prop に渡す。
 * identity の状態に応じてローディング/エラー/本体を切り替える。
 */
export function IdentityHero({ identity, filterBar }: IdentityHeroProps): ReactElement {
  const content = (() => {
    switch (identity.kind) {
      case 'loading':
        return <IdentityHeroLoading />;
      case 'notFound':
        return <IdentityHeroNotFound />;
      case 'error':
        return <IdentityHeroError message={identity.message} />;
      case 'ready':
        return (
          <IdentityHeroReady
            lv={identity.identity.level}
            nickname={identity.identity.nickname}
          />
        );
    }
  })();

  return (
    <>
      {content}
      {filterBar}
    </>
  );
}
