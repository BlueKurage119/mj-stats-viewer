import type { ReactElement } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HomePlaceholder } from './HomePlaceholder';
import { PlaceholderPanel } from './PlaceholderPanel';
import { PlayerLayout } from './PlayerLayout';
import { VISIBLE_TABS } from './paths';

export function AppRouter(): ReactElement {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePlaceholder />} />
        <Route path="/:np/player/:id" element={<PlayerLayout />}>
          <Route index element={<Navigate to="summary" replace />} />
          {VISIBLE_TABS.map((tab) => (
            <Route
              key={tab.id}
              path={tab.id}
              element={<PlaceholderPanel tab={tab.id} />}
            />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
