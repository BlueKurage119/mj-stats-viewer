/**
 * API層のエラー分類（docs/design/issue-3-api-layer.md §5.5）。
 *
 * erasableSyntaxOnly のため constructor パラメータプロパティは使えない。
 * フィールド宣言 + コンストラクタ本体での代入で統一する。
 */

/** HTTP エラー・全ミラー失敗・result_key 打ち切り */
export class ApiError extends Error {
  status: number; // HTTP ステータス。ネットワーク全滅は 0
  url: string; // 最後に試みた URL（パス部分）

  constructor(message: string, status: number, url: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
  }
}

/** `{"maintenance": "..."}` レスポンス */
export class MaintenanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaintenanceError';
  }
}

/** RangeResolver が対応していない RangeSpec を受け取ったとき（§6.4） */
export class RangeNotSupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RangeNotSupportedError';
  }
}
