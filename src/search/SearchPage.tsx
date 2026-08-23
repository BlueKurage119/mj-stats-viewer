import type { ReactElement } from 'react';
import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { NumPlayers } from '../api';
import {
  OutlinedSegmentedButton,
  OutlinedSegmentedButtonSet,
  OutlinedTextField,
  Ripple,
} from '../components/md';
import { playerPath } from '../shell/paths';
import { crossModeLabel, formatLastPlayedDate, formatLevel } from './format';
import './search.css';
import { useSearch } from './useSearch';

/**
 * 四麻/三麻トグルの並び順を唯一の情報源として定義する。
 * OutlinedSegmentedButtonSet の selection index はこの配列のインデックスと一致させる
 * ことで、ボタンの描画順を入れ替えても selection の対応関係が自動的に追従する。
 */
const NP_TOGGLE_OPTIONS: readonly { numPlayers: NumPlayers; label: string }[] = [
  { numPlayers: 4, label: '四人打ち' },
  { numPlayers: 3, label: '三人打ち' },
];

export function SearchPage(): ReactElement {
  const [numPlayers, setNumPlayers] = useState<NumPlayers>(4);
  const { query, setQuery, state, retry } = useSearch(numPlayers);

  const resultRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const handleNpSelection = (
    e: CustomEvent<{ selected: boolean; index: number }>,
  ) => {
    const option = NP_TOGGLE_OPTIONS[e.detail.index];
    if (option) {
      setNumPlayers(option.numPlayers);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      if (state.kind === 'results' && state.items.length > 0) {
        e.preventDefault();
        resultRefs.current[0]?.focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
    }
  };

  const handleResultKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (state.kind !== 'results') return;
    const count = state.items.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(count - 1, index + 1);
      resultRefs.current[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index === 0) {
        resultRefs.current[0]?.focus();
      } else {
        resultRefs.current[index - 1]?.focus();
      }
    }
  };

  let statusContent: React.ReactNode = null;
  let resultsList: React.ReactNode = null;

  if (state.kind === 'idle') {
    statusContent = 'ニックネームを入力してください';
  } else if (state.kind === 'loading') {
    statusContent = '検索中…';
    resultsList = (
      <ul className="search-results" data-testid="search-results">
        <li className="search-skeleton" data-testid="search-skeleton" />
        <li className="search-skeleton" data-testid="search-skeleton" />
        <li className="search-skeleton" data-testid="search-skeleton" />
      </ul>
    );
  } else if (state.kind === 'results') {
    if (state.items.length === 0) {
      statusContent = '該当するプレイヤーが見つかりませんでした';
    } else {
      statusContent = `${state.items.length}件`;
      resultsList = (
        <ul className="search-results" data-testid="search-results">
          {state.items.map((item, index) => {
            const mode = crossModeLabel(item.level.id, numPlayers);
            return (
              <li key={item.id}>
                <Link
                  to={playerPath({
                    numPlayers,
                    playerId: String(item.id),
                    tab: 'summary',
                  })}
                  className="search-result"
                  data-testid="search-result"
                  data-player-id={String(item.id)}
                  ref={(el) => {
                    resultRefs.current[index] = el;
                  }}
                  onKeyDown={(e) => handleResultKeyDown(e, index)}
                >
                  <Ripple />
                  <span className="search-result__nick md-typescale-body-large">
                    {item.nickname}
                  </span>
                  <span className="search-result__level md-typescale-body-medium">
                    {formatLevel(item.level)}
                  </span>
                  {mode && (
                    <span className="search-result__mode md-typescale-label-small">
                      {mode}
                    </span>
                  )}
                  <span className="search-result__date md-typescale-body-small">
                    {formatLastPlayedDate(item.lastPlayedAtMs)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      );
    }
  } else if (state.kind === 'error') {
    statusContent = (
      <>
        <span>{state.message}</span>
        <button
          type="button"
          className="search-retry-button md-typescale-label-large"
          data-testid="search-retry"
          onClick={retry}
        >
          再試行
        </button>
      </>
    );
  }

  return (
    <div className="search-page" data-testid="search-page">
      <header className="app-header" data-testid="app-header">
        <span className="app-header__title md-typescale-title-medium">
          mj-stats-viewer
        </span>
        <OutlinedSegmentedButtonSet
          data-testid="search-np-toggle"
          onSegmentedButtonSetSelection={handleNpSelection}
        >
          {NP_TOGGLE_OPTIONS.map((option) => (
            <OutlinedSegmentedButton
              key={option.numPlayers}
              label={option.label}
              selected={numPlayers === option.numPlayers}
            />
          ))}
        </OutlinedSegmentedButtonSet>
      </header>

      <main className="search-main">
        <OutlinedTextField
          type="search"
          label="ニックネーム"
          value={query}
          className="search-field"
          data-testid="search-input"
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleInputKeyDown}
        />

        <div
          className="search-status md-typescale-body-medium"
          aria-live="polite"
          data-testid="search-status"
        >
          {statusContent}
        </div>

        {resultsList}
      </main>
    </div>
  );
}
