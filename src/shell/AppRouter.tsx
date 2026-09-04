import type { ReactElement } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SearchPage } from '../search/SearchPage';
import { PlaceholderPanel } from './PlaceholderPanel';
import { PlayerLayout } from './PlayerLayout';
import { VISIBLE_TABS } from './paths';
import { SummaryPanel } from '../summary/SummaryPanel';

export function AppRouter(): ReactElement {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/:np/player/:id" element={<PlayerLayout />}>
          <Route index element={<Navigate to="summary" replace />} />
          {VISIBLE_TABS.map((tab) =>
            tab.id === 'summary' ? (
              <Route key={tab.id} path={tab.id} element={<SummaryPanel />} />
            ) : (
              <Route key={tab.id} path={tab.id} element={<PlaceholderPanel tab={tab.id} />} />
            ),
          )}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
