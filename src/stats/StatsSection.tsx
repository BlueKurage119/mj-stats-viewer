import { useEffect, useState, type ReactElement } from 'react';
import { ElevatedCard, Icon, List, ListItem } from '../components/md';
import type { StatSectionView } from './statsView';

export interface StatsSectionProps {
  readonly section: StatSectionView;
}

const DIST_GROUPS = [
  { key: 'winState', title: '和了時の状態' },
  { key: 'dealInState', title: '放銃時の状態' },
  { key: 'dealInTarget', title: '放銃相手の状態' },
] as const;

export function StatsSection({ section }: StatsSectionProps): ReactElement {
  const [openTipKey, setOpenTipKey] = useState<string | null>(null);

  useEffect(() => {
    if (openTipKey === null) return;
    const handleOutsidePointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.stats-row__info-btn') || target?.closest('.stats-row__tip')) {
        return;
      }
      setOpenTipKey(null);
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
    };
  }, [openTipKey]);

  return (
    <ElevatedCard className="stats-section-card" data-section={section.id}>
      <section className="stats-section">
        <h2 className="stats-section__title md-typescale-title-small">{section.title}</h2>
        {section.note && (
          <p className="stats-section__note md-typescale-body-small">{section.note}</p>
        )}

        {section.id === 'rank' && (
          <div className="stats-table-container">
            <table className="stats-table stats-table--rank">
              <thead>
                <tr>
                  <th scope="col" className="stats-table__th">順位</th>
                  <th scope="col" className="stats-table__th stats-table__th--num">回数</th>
                  <th scope="col" className="stats-table__th stats-table__th--num">割合</th>
                  <th scope="col" className="stats-table__th stats-table__th--num">平均点数</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((r) => (
                  <tr key={r.key} data-row={r.key} className="stats-table__row">
                    <td className="stats-table__cell stats-table__cell--label">{r.label}</td>
                    <td className="stats-table__cell stats-table__cell--num stats-table__cell--value md-typescale-title-medium numeric">
                      {r.countText}
                    </td>
                    <td className="stats-table__cell stats-table__cell--num stats-table__cell--value md-typescale-title-medium numeric">
                      {r.percentText}
                    </td>
                    <td className="stats-table__cell stats-table__cell--num stats-table__cell--value md-typescale-title-medium numeric">
                      {r.avgScoreText}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {section.id === 'distribution' && (
          <div className="stats-dist-groups">
            {DIST_GROUPS.map((g) => {
              const groupRows = section.rows.filter((r) => r.subGroup === g.key);
              return (
                <div key={g.key} className="stats-dist-group">
                  <h3 className="stats-dist-group__title md-typescale-label-large">{g.title}</h3>
                  <div className="stats-table-container">
                    <table className="stats-table stats-table--dist">
                      <thead>
                        <tr>
                          <th scope="col" className="stats-table__th">状態</th>
                          <th scope="col" className="stats-table__th stats-table__th--num">回数</th>
                          <th scope="col" className="stats-table__th stats-table__th--num">割合</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupRows.map((r) => (
                          <tr key={r.key} data-row={r.key} className="stats-table__row">
                            <td className="stats-table__cell stats-table__cell--label">{r.label}</td>
                            <td className="stats-table__cell stats-table__cell--num stats-table__cell--value md-typescale-title-medium numeric">
                              {r.countText}
                            </td>
                            <td className="stats-table__cell stats-table__cell--num stats-table__cell--value md-typescale-title-medium numeric">
                              {r.percentText}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {section.id !== 'rank' && section.id !== 'distribution' && (
          <List className="stats-section__list">
            {section.rows.map((r) => {
              const hasNote = r.note.length > 0;
              const isTipOpen = openTipKey === r.key;
              const tipId = `tip-${section.id}-${r.key}`;
              return (
                <div
                  className="stats-row"
                  key={r.key}
                  data-row={r.key}
                  data-has-note={hasNote ? 'true' : 'false'}
                  data-tip-open={isTipOpen ? 'true' : 'false'}
                >
                  <ListItem>
                    <span slot="headline" className="stats-row__headline">
                      <span className="stats-row__label">{r.label}</span>
                      {hasNote && (
                        <button
                          type="button"
                          className="stats-row__info-btn"
                          aria-label={`${r.label}の注記`}
                          aria-describedby={tipId}
                          aria-expanded={isTipOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            const willClose = openTipKey === r.key;
                            setOpenTipKey(willClose ? null : r.key);
                            if (willClose) {
                              e.currentTarget.blur();
                            }
                          }}
                        >
                          <Icon className="stats-row__info-icon">info</Icon>
                        </button>
                      )}
                    </span>
                    <span
                      slot="trailing-supporting-text"
                      className="stats-row__value md-typescale-title-medium numeric"
                    >
                      {r.valueText}
                    </span>
                  </ListItem>
                  {hasNote && (
                    <span className="stats-row__tip" id={tipId} role="tooltip">
                      {r.note}
                    </span>
                  )}
                </div>
              );
            })}
          </List>
        )}
      </section>
    </ElevatedCard>
  );
}
