import type { ReactElement } from 'react';
import type { GameMode, NumPlayers, PeriodPreset } from '../api';
import { allModes } from '../api';
import { ChipSet, FilterChip } from '../components/md';
import {
  MODE_LABELS,
  PERIOD_OPTIONS,
  toggleMode,
  type GlobalFilter,
} from './filterState';
import './filters.css';

export interface FilterBarProps {
  numPlayers: NumPlayers;
  filter: GlobalFilter | null; // null のときはチップを disabled で描画（レイアウトシフトを避ける）
  onModesChange: (next: readonly GameMode[]) => void;
  onPeriodChange: (next: PeriodPreset) => void;
}

export function FilterBar(props: FilterBarProps): ReactElement {
  const { numPlayers, filter, onModesChange, onPeriodChange } = props;
  const currentModes = filter ? filter.modes : [];
  const selectedModeSet = new Set(currentModes);
  const disabled = filter === null;

  return (
    <div className="filter-bar" data-testid="filter-bar">
      <ChipSet className="filter-bar__row" data-testid="mode-chips">
        {allModes(numPlayers).map((mode) => (
          <FilterChip
            key={mode}
            data-mode={mode}
            label={MODE_LABELS[mode]}
            selected={selectedModeSet.has(mode)}
            disabled={disabled}
            onClick={(e) => {
              if (disabled) return;
              const next = toggleMode(currentModes, mode, numPlayers);
              e.currentTarget.selected = next.includes(mode); // §1.2 の必須規約
              onModesChange(next);
            }}
          />
        ))}
      </ChipSet>
      <ChipSet className="filter-bar__row" data-testid="period-chips">
        {PERIOD_OPTIONS.map(({ preset, label }) => (
          <FilterChip
            key={preset}
            data-period={preset}
            label={label}
            selected={filter?.period === preset}
            disabled={disabled}
            onClick={(e) => {
              if (disabled) return;
              e.currentTarget.selected = true;
              onPeriodChange(preset);
            }}
          />
        ))}
      </ChipSet>
    </div>
  );
}
