import { useState, type CSSProperties, type ReactElement } from 'react';
import {
  Badge,
  ChipSet,
  CircularProgress,
  Divider,
  Elevation,
  ElevatedCard,
  FilledButton,
  FilledCard,
  FilledTonalButton,
  FilterChip,
  Icon,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  Menu,
  MenuItem,
  NavigationBar,
  NavigationTab,
  OutlinedCard,
  OutlinedSegmentedButton,
  OutlinedSegmentedButtonSet,
  OutlinedSelect,
  OutlinedTextField,
  PrimaryTab,
  Ripple,
  SelectOption,
  Tabs,
  TextButton,
} from '../components/md';

/**
 * dev 専用の `/__components` 確認ページ。
 * 本番ビルドでは main.tsx の `import.meta.env.DEV` 分岐により到達不能・emit されない。
 * Issue 2: @material/web 型付き React ラッパー29点の描画確認と登録チェック。
 */

/** ラップ対象29点のタグ名（設計書 §3 の表と同一。dev 専用ファイルなので重複定義を許容） */
const WRAPPED_TAGS = [
  'md-filled-button',
  'md-filled-tonal-button',
  'md-text-button',
  'md-icon-button',
  'md-tabs',
  'md-primary-tab',
  'md-navigation-bar',
  'md-navigation-tab',
  'md-chip-set',
  'md-filter-chip',
  'md-outlined-segmented-button',
  'md-outlined-segmented-button-set',
  'md-elevated-card',
  'md-filled-card',
  'md-outlined-card',
  'md-badge',
  'md-divider',
  'md-elevation',
  'md-ripple',
  'md-linear-progress',
  'md-circular-progress',
  'md-outlined-text-field',
  'md-menu',
  'md-menu-item',
  'md-outlined-select',
  'md-select-option',
  'md-icon',
  'md-list',
  'md-list-item',
] as const;

function RegistrationCheckTable(): ReactElement {
  return (
    <table>
      <thead>
        <tr>
          <th className="md-typescale-label-medium">タグ名</th>
          <th className="md-typescale-label-medium">登録状態</th>
        </tr>
      </thead>
      <tbody>
        {WRAPPED_TAGS.map((tag) => {
          const defined = customElements.get(tag) !== undefined;
          return (
            <tr key={tag}>
              <td className="md-typescale-body-small numeric">{tag}</td>
              <td
                className="md-typescale-label-medium"
                style={{ color: defined ? 'var(--md-sys-color-tertiary)' : 'var(--md-sys-color-error)' }}
              >
                {defined ? '定義済み' : '未定義'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Section({ title, children }: { title: string; children: ReactElement | ReactElement[] }): ReactElement {
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2 className="md-typescale-title-medium" style={{ marginBottom: '0.75rem' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>{children}</div>
    </section>
  );
}

function TabsDemo(): ReactElement {
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <div>
      <Tabs onChange={(e) => setActiveIndex(e.currentTarget.activeTabIndex)}>
        <PrimaryTab>順位分布</PrimaryTab>
        <PrimaryTab>総合成績</PrimaryTab>
        <PrimaryTab>立直統計</PrimaryTab>
      </Tabs>
      <p className="md-typescale-body-medium">選択中: {activeIndex}</p>
    </div>
  );
}

function ButtonsDemo(): ReactElement {
  const [toggleCount, setToggleCount] = useState(0);
  return (
    <>
      <FilledButton>塗りボタン</FilledButton>
      <FilledTonalButton>トナルボタン</FilledTonalButton>
      <TextButton>テキストボタン</TextButton>
      <div>
        <IconButton toggle onChange={() => setToggleCount((n) => n + 1)}>
          <Icon>favorite</Icon>
        </IconButton>
        <span className="md-typescale-body-small numeric"> onChange回数: {toggleCount}</span>
      </div>
    </>
  );
}

function IconsDemo(): ReactElement {
  return (
    <>
      <Icon>home</Icon>
      <Icon>search</Icon>
      <Icon>trending_up</Icon>
      <Icon>bar_chart</Icon>
      <Icon>settings</Icon>
      <p className="md-typescale-body-small">
        （上記が「home」等の生テキストに見える場合は Material Symbols フォント未読込）
      </p>
    </>
  );
}

function NavDemo(): ReactElement {
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <div>
      <NavigationBar
        activeIndex={activeIndex}
        onNavigationBarActivated={(e) => setActiveIndex(e.detail.activeIndex)}
      >
        <NavigationTab label="ホーム">
          <Icon slot="active-icon">home</Icon>
          <Icon slot="inactive-icon">home</Icon>
        </NavigationTab>
        <NavigationTab label="検索">
          <Icon slot="active-icon">search</Icon>
          <Icon slot="inactive-icon">search</Icon>
        </NavigationTab>
        {/*
          md-navigation-tab のスロットは active-icon / inactive-icon の2つのみで
          デフォルトスロットが無い（navigation-tab.js の <slot> を確認済み）。
          バッジは子要素として置くのではなく showBadge/badgeValue プロパティで
          内部描画させる（NavigationTab.d.ts: showBadge時に内部で md-badge を描画）。
        */}
        <NavigationTab label="通知" showBadge badgeValue="3">
          <Icon slot="active-icon">trending_up</Icon>
          <Icon slot="inactive-icon">trending_up</Icon>
        </NavigationTab>
      </NavigationBar>
      <p className="md-typescale-body-medium">activeIndex: {activeIndex}</p>

      {/*
        Badge 単体の描画確認区画。md-badge は shadow 内で position: absolute を使うため、
        position: relative な親の中に置く（10. 素材系の Elevation と同じ作法）。
      */}
      <div style={{ position: 'relative', width: 32, height: 32, marginTop: '0.5rem' }}>
        <Badge value="9" />
      </div>
    </div>
  );
}

function SelectionDemo(): ReactElement {
  const [selectedLabel, setSelectedLabel] = useState('-');
  const [segmentIndex, setSegmentIndex] = useState(0);
  return (
    <>
      <div>
        <ChipSet>
          <FilterChip label="東" onClick={(e) => setSelectedLabel(`東: ${e.currentTarget.selected}`)} />
          <FilterChip label="南" onClick={(e) => setSelectedLabel(`南: ${e.currentTarget.selected}`)} />
          <FilterChip label="削除可" removable onRemove={() => setSelectedLabel('削除可: removeされた')} />
        </ChipSet>
        <p className="md-typescale-body-small numeric">{selectedLabel}</p>
      </div>
      <div>
        <OutlinedSegmentedButtonSet
          onSegmentedButtonSetSelection={(e) => setSegmentIndex(e.detail.index)}
        >
          <OutlinedSegmentedButton label="1ヶ月" />
          <OutlinedSegmentedButton label="半年" />
          <OutlinedSegmentedButton label="全期間" />
        </OutlinedSegmentedButtonSet>
        <p className="md-typescale-body-small numeric">選択index: {segmentIndex}</p>
      </div>
    </>
  );
}

function CardsDemo(): ReactElement {
  return (
    <>
      <ElevatedCard style={{ padding: '1rem', minWidth: 220 }}>
        <List>
          <ListItem>
            <div slot="headline">ツモ率</div>
            <div slot="supporting-text">和了回数比</div>
            <div slot="end">36.54%</div>
          </ListItem>
        </List>
      </ElevatedCard>
      <FilledCard style={{ padding: '1rem', minWidth: 220 }}>
        <List>
          <ListItem>
            <div slot="headline">放銃率</div>
            <div slot="supporting-text">局数比</div>
            <div slot="end">12.30%</div>
          </ListItem>
        </List>
      </FilledCard>
      <OutlinedCard style={{ padding: '1rem', minWidth: 220 }}>
        <List>
          <ListItem>
            <div slot="headline">立直率</div>
            <div slot="supporting-text">局数比</div>
            <div slot="end">18.90%</div>
          </ListItem>
        </List>
      </OutlinedCard>
    </>
  );
}

function ProgressDemo(): ReactElement {
  return (
    <>
      <div style={{ minWidth: 200 }}>
        <LinearProgress value={0.6} />
      </div>
      <div style={{ minWidth: 200 }}>
        <LinearProgress indeterminate />
      </div>
      <CircularProgress value={0.6} />
      <CircularProgress indeterminate />
    </>
  );
}

function InputsDemo(): ReactElement {
  const [text, setText] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuResult, setMenuResult] = useState('-');

  return (
    <>
      <OutlinedTextField
        label="プレイヤー名"
        onInput={(e) => setText(e.currentTarget.value)}
      />
      <p className="md-typescale-body-small numeric">入力値: {text}</p>

      <OutlinedSelect
        label="表示期間"
        onChange={(e) => setSelectValue(e.currentTarget.value)}
      >
        <SelectOption value="1m">
          <div slot="headline">1ヶ月</div>
        </SelectOption>
        <SelectOption value="6m">
          <div slot="headline">半年</div>
        </SelectOption>
        <SelectOption value="all">
          <div slot="headline">全期間</div>
        </SelectOption>
      </OutlinedSelect>
      <p className="md-typescale-body-small numeric">選択値: {selectValue}</p>

      <div style={{ position: 'relative' }}>
        <FilledButton id="menu-anchor" onClick={() => setMenuOpen((open) => !open)}>
          メニューを開く
        </FilledButton>
        {/*
          md-menu は anchor プロパティを位置合わせにのみ使い、クリックでは自動的に開かない。
          open を React state で制御する。close-menu（項目選択による確定的な閉じる合図）と
          closed（アニメーション完了後。外側クリック等 close-menu を経ない閉じ方も含む）の
          両方で state を追従させる。close-menu 側でも閉じておくことで、クローズアニメーションの
          完了を待たずに（環境によっては動かないタブでアニメーションが完了しないこともあるため）
          確定的に閉じられる。positioning は既定の absolute のままで良いが、anchor と共通の
          position: relative な祖先が要る（設計書 §7.2 の修正どおり、この div がそれを兼ねる）。
        */}
        <Menu
          anchor="menu-anchor"
          open={menuOpen}
          onClosed={() => setMenuOpen(false)}
          onCloseMenu={(e) => {
            setMenuResult(e.detail.itemPath[0]?.textContent?.trim() ?? '-');
            setMenuOpen(false);
          }}
        >
          <MenuItem>
            <div slot="headline">上位</div>
          </MenuItem>
          <MenuItem>
            <div slot="headline">下位</div>
          </MenuItem>
        </Menu>
        <p className="md-typescale-body-small numeric">選択結果: {menuResult}</p>
      </div>
    </>
  );
}

function MaterialsDemo(): ReactElement {
  return (
    <>
      <Divider />
      <div
        style={{
          position: 'relative',
          width: 160,
          height: 80,
          borderRadius: 8,
          background: 'var(--md-sys-color-surface-container)',
        }}
      >
        <Elevation style={{ '--md-elevation-level': 2 } as CSSProperties} />
        <Ripple />
        <p className="md-typescale-body-small" style={{ padding: '0.5rem' }}>
          Elevation + Ripple
        </p>
      </div>
    </>
  );
}

export function ComponentGallery(): ReactElement {
  // ラッパーの import はモジュール評価時（本コンポーネントの import 文の時点）に
  // customElements.define を副作用として済ませているため、初回描画から確定値を表示できる。
  return (
    <main style={{ padding: '2rem' }}>
      <h1 className="md-typescale-headline-medium">@material/web ラッパー確認（29点）</h1>

      <Section title="1. 登録チェック">{<RegistrationCheckTable />}</Section>
      <Section title="2. Tabs">{<TabsDemo />}</Section>
      <Section title="3. ボタン">{<ButtonsDemo />}</Section>
      <Section title="4. アイコン">{<IconsDemo />}</Section>
      <Section title="5. ナビ">{<NavDemo />}</Section>
      <Section title="6. 選択系">{<SelectionDemo />}</Section>
      <Section title="7. カード">{<CardsDemo />}</Section>
      <Section title="8. 進行">{<ProgressDemo />}</Section>
      <Section title="9. 入力">{<InputsDemo />}</Section>
      <Section title="10. 素材系">{<MaterialsDemo />}</Section>
    </main>
  );
}
