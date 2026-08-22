import type { ReactElement, ReactNode } from 'react';

export interface LayeredSheetProps {
  /** テーマ背景の上に置く主要数値領域（Issue 8 が中身を差し込む） */
  hero: ReactNode;
  /** せり上がるカード層 */
  children: ReactNode;
}

export function LayeredSheet(props: LayeredSheetProps): ReactElement {
  return (
    <div className="layered-sheet">
      <section className="layered-sheet__hero" data-testid="sheet-hero">
        {props.hero}
      </section>
      <div className="layered-sheet__layer" data-testid="sheet-layer">
        {props.children}
      </div>
    </div>
  );
}
