# mj-stats-viewer

雀魂の段位戦スタッツを、ヒストグラム・レーダーチャートなどで見やすくビジュアライズする非公式Webアプリ。

「自分の成績は卓全体のどこに位置するのか」を主役に、Material 3 Expressive スタイルのダッシュボードで表示します。四人麻雀・三人麻雀の両方に対応予定です。

## データ出典

[雀魂牌譜屋 (amae-koromo)](https://amae-koromo.sapk.ch/) の公開APIを利用しています。
本プロジェクトは雀魂・牌譜屋のいずれとも無関係の非公式ツールです。APIへのリクエストは必要最小限に抑える設計としています。

## 技術スタック

- Vite + React 19 + TypeScript
- [@material/web](https://github.com/material-components/material-web)（Material 3 Web Components）+ @lit/react
- @material/material-color-utilities 0.3.0（バージョン固定 — 0.4.x はパッケージング不具合のため）
- Recharts / dayjs

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm run build    # 型チェック + 本番ビルド
```

## ステータス

概念実証（PoC）段階。設計ドキュメントはリポジトリ外で管理しています。
