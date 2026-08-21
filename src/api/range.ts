/**
 * 期間解決インターフェース（docs/design/issue-3-api-layer.md §6.4 / 要件 §5.2 の将来拡張点）。
 *
 * 「直近n戦」（player_records 必須・承諾後実装）を、API層の呼び出し規約を変えずに
 * 追加できる形をここで確定する。lastNGames は現時点では RangeNotSupportedError を throw する。
 */

import type { NumPlayers } from './gameMode';
import { RangeNotSupportedError } from './errors';

/** 2010-01-01T00:00:00Z（= 1262304000000。本家 PlayerDataLoader の既定 startDate と同値） */
export const DATA_MIN_MS = 1262304000000;

/**
 * データ収集開始日を表す新しい Date を毎回組み立てて返す。
 *
 * 以前は `export const DATA_MIN_DATE = new Date(...)` として可変 Date インスタンスを
 * 直接公開していたが、消費側が戻り値に対して setFullYear 等の破壊的メソッドを呼ぶと
 * バレル経由で共有しているこのインスタンス自体が汚染され、以降の全ての「全期間」クエリと
 * getCurrentLevel が壊れた開始時刻を使い続ける事故があった（PR #22 再レビュー指摘）。
 * 不変なタイムスタンプ（DATA_MIN_MS）を保持し、Date が要る場所は都度これで組み立てる。
 */
export function dataMinDate(): Date {
  return new Date(DATA_MIN_MS);
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** 現在時刻を次の1時間境界へ切り上げた Date。URL を1時間安定にしてキャッシュを効かせる（§5.2・§6.3） */
export function currentHourEnd(): Date {
  const nextHourMs = Math.ceil(Date.now() / HOUR_MS) * HOUR_MS;
  return new Date(nextHourMs);
}

export type PeriodPreset = 'all' | '1y' | '90d' | '30d' | '7d';

export type RangeSpec =
  | { kind: 'preset'; preset: PeriodPreset }
  | { kind: 'lastNGames'; n: 100 | 200 | 300 | 500 }; // 承諾後に有効化

export type ResolvedRange = { start: Date; end: Date };

export interface RangeResolver {
  resolve(spec: RangeSpec, numPlayers: NumPlayers, playerId: number): Promise<ResolvedRange>;
}

const PRESET_DAYS: Record<Exclude<PeriodPreset, 'all'>, number> = {
  '1y': 365,
  '90d': 90,
  '30d': 30,
  '7d': 7,
};

function resolvePreset(preset: PeriodPreset): ResolvedRange {
  const end = currentHourEnd();
  if (preset === 'all') {
    // dataMinDate() は呼ぶたびに新しい Date を返すため、共有インスタンスの汚染は起きない
    return { start: dataMinDate(), end };
  }
  const start = new Date(end.getTime() - PRESET_DAYS[preset] * DAY_MS);
  return { start, end };
}

/**
 * preset のみ解決する既定実装。lastNGames は RangeNotSupportedError を throw する。
 * throw を（同期例外ではなく）Promise rejection にするため resolve は async のまま維持する。
 */
export const defaultRangeResolver: RangeResolver = {
  async resolve(spec, _numPlayers, _playerId) {
    if (spec.kind === 'lastNGames') {
      throw new RangeNotSupportedError(
        'lastNGames requires player_records (CAP-protected) and is not implemented yet',
      );
    }
    return resolvePreset(spec.preset);
  },
};

let currentResolver: RangeResolver = defaultRangeResolver;

export function resolveRange(
  spec: RangeSpec,
  numPlayers: NumPlayers,
  playerId: number,
): Promise<ResolvedRange> {
  return currentResolver.resolve(spec, numPlayers, playerId);
}

/** 承諾後: player_records ベースの resolver を差し込む（それまで呼ばれない） */
export function setRangeResolver(resolver: RangeResolver): void {
  currentResolver = resolver;
}
