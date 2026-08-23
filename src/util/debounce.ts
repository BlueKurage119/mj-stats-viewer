export interface Debouncer<T> {
  /** 直近の値で delayMs 後に1回だけ onFire を呼ぶ。呼ぶたびにタイマーは張り直される */
  schedule(value: T): void;
  /** 予約中の発火を取り消す。取り消し後に schedule すれば再び予約できる */
  cancel(): void;
}

export function createDebouncer<T>(
  delayMs: number,
  onFire: (value: T) => void,
): Debouncer<T> {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  return {
    schedule(value: T): void {
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      timerId = setTimeout(() => {
        timerId = null;
        onFire(value);
      }, delayMs);
    },
    cancel(): void {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    },
  };
}
