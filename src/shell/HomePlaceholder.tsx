import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

export function HomePlaceholder(): ReactElement {
  return (
    <div className="home-placeholder" style={{ padding: '24px' }}>
      <h1 className="md-typescale-headline-medium">mj-stats-viewer</h1>
      <p className="md-typescale-body-large">プレイヤーを検索してください（検索画面は #7）</p>
      <div style={{ marginTop: '16px' }}>
        <p className="md-typescale-body-medium">サンプルリンク:</p>
        <Link to="/4/player/123456/summary" className="md-typescale-body-medium">
          プレイヤー 123456 (四人打ち・サマリー)
        </Link>
      </div>
    </div>
  );
}
