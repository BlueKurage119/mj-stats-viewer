import type { ReactElement } from 'react';
import { List, ListItem } from '../components/md';
import type { StatSectionView } from './statsView';

export interface StatsSectionProps {
  readonly section: StatSectionView;
}

export function StatsSection({ section }: StatsSectionProps): ReactElement {
  return (
    <section className="stats-section" data-section={section.id}>
      <h2 className="stats-section__title md-typescale-title-small">{section.title}</h2>
      {section.note && (
        <p className="stats-section__note md-typescale-body-small">{section.note}</p>
      )}
      <List className="stats-section__list">
        {section.rows.map((r) => {
          const hasNote = r.note.length > 0;
          const tipId = `tip-${section.id}-${r.key}`;
          return (
            <div
              className="stats-row"
              key={r.key}
              data-row={r.key}
              data-has-note={hasNote ? 'true' : 'false'}
            >
              <ListItem>
                <span
                  slot="headline"
                  className={hasNote ? 'stats-row__label stats-row__label--tip' : 'stats-row__label'}
                  {...(hasNote ? { tabIndex: 0, 'aria-describedby': tipId } : {})}
                >
                  {r.label}
                </span>
                <span slot="trailing-supporting-text" className="stats-row__value">
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
    </section>
  );
}
