import { useEffect, useState } from 'react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PlayerLayout } from '../shell/PlayerLayout';
import { SearchPage } from '../search/SearchPage';
import { SummaryPanel } from '../summary/SummaryPanel';
import { ComparePanel } from '../compare/ComparePanel';
import { StatsPanel } from '../stats/StatsPanel';
import type { RankKey } from '../theme/seeds';
import { useTheme } from '../theme/ThemeProvider';
import { SCENARIOS, type FixtureSession, type Scenario } from './fixtureFetch';
function LocationProbe() { const location = useLocation(); return <output data-testid="fixture-location">{location.pathname}{location.search}</output>; }
export function StateGallery({session, scenario}: {session: FixtureSession; scenario: Scenario}) {
  const [, refresh] = useState(0);
  const theme = useTheme();
  useEffect(() => session.subscribe(() => refresh(n=>n+1)), [session]);
  // Transport installation is outside React so StrictMode cannot restore it between mounts.
  useEffect(() => { const release = session.retain(); const restore = () => session.restore(); window.addEventListener('pagehide', restore); return () => {window.removeEventListener('pagehide', restore); release();}; }, [session]);
  const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const tab = params.get('tab') ?? 'summary';
  const entry = tab === 'search' ? '/' : `/4/player/1/${tab}?mode=16.12&period=${scenario.startsWith('race') ? '7d' : '30d'}`;
  return <>
    <div className="state-gallery-controls" style={{padding: '16px', background: 'var(--md-sys-color-surface-container)', color: 'var(--md-sys-color-on-surface)'}}>
      <h1 className="md-typescale-title-large">取得状態の確認</h1>
      <label>シナリオ <select aria-label="シナリオ" value={scenario} onChange={e=>{location.hash=`/__states?scenario=${e.target.value}&tab=${tab}`; location.reload();}}>{SCENARIOS.map(name=><option key={name}>{name}</option>)}</select></label>{' '}
      <label>画面 <select aria-label="画面" value={tab} onChange={e=>{location.hash=`/__states?scenario=${scenario}&tab=${e.target.value}`; location.reload();}}>{['summary','compare','stats','search'].map(name=><option key={name}>{name}</option>)}</select></label>{' '}
      <label>テーマ <select aria-label="テーマ" value={theme.rank ?? 'default'} onChange={e=>theme.setRank(e.target.value === 'default' ? null : e.target.value as RankKey)}>{['default','ketsu','gou','sei','konten'].map(rank=><option key={rank}>{rank}</option>)}</select></label>{' '}
      <button onClick={()=>session.release()}>保留した応答を解決</button>{' '}
      <button onClick={()=>theme.setModeSetting(theme.resolvedDark?'light':'dark')}>ライト/ダーク切替</button>
      <details><summary>要求履歴 ({session.requests.length})・保留 ({session.pending.size})</summary><pre data-testid="fixture-requests" style={{whiteSpace:'pre-wrap', overflowWrap:'anywhere'}}>{JSON.stringify(session.requests, null, 2)}</pre></details>
    </div>
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/:np/player/:id" element={<PlayerLayout />}>
          <Route index element={<Navigate to="summary" replace />} />
          <Route path="summary" element={<SummaryPanel />} />
          <Route path="compare" element={<ComparePanel />} />
          <Route path="stats" element={<StatsPanel />} />
        </Route>
      </Routes>
    </MemoryRouter>
  </>;
}
