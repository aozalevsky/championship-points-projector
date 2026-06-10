import { UI, teamColor } from '../theme';
import { DriverAvatar, TeamIcon } from './Icons';
import type { DriverProjection } from '../types';

interface Props {
  projections: DriverProjection[];
  hovered: string | null;
  onHover: (driverId: string | null) => void;
  /** column header: Driver / Rider / Constructor */
  entityLabel: string;
  isConstructors: boolean;
  /** ids hidden from the chart (visual only) */
  hidden: Set<string>;
  onToggleVisible: (id: string) => void;
  onSetAllVisible: (visible: boolean) => void;
}

const GRID = '20px 28px 38px 1fr 60px 88px';

export function Standings({
  projections,
  hovered,
  onHover,
  entityLabel,
  isConstructors,
  hidden,
  onToggleVisible,
  onSetAllVisible,
}: Props) {
  const allVisible = hidden.size === 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID,
          gap: 8,
          alignItems: 'center',
          padding: '4px 10px',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: UI.textDim,
        }}
      >
        <input
          type="checkbox"
          checked={allVisible}
          onChange={(e) => onSetAllVisible(e.target.checked)}
          title={allVisible ? 'Hide all from chart' : 'Show all on chart'}
          style={{ accentColor: UI.red, cursor: 'pointer', margin: 0 }}
        />
        <span>Pos</span>
        <span />
        <span>{entityLabel}</span>
        <span style={{ textAlign: 'right' }}>Pts</span>
        <span style={{ textAlign: 'right' }}>Final range</span>
      </div>
      {projections.map((p) => {
        const color = teamColor(p.team.id);
        const active = hovered === p.driver.id;
        const isHidden = hidden.has(p.driver.id);
        const titleLocked = p.bestFinalRank === 1 && p.worstFinalRank === 1;
        return (
          <div
            key={p.driver.id}
            onMouseEnter={() => onHover(p.driver.id)}
            onMouseLeave={() => onHover(null)}
            style={{
              display: 'grid',
              gridTemplateColumns: GRID,
              gap: 8,
              alignItems: 'center',
              padding: '5px 10px',
              borderRadius: 8,
              background: active ? '#2A2A3C' : UI.panel,
              borderLeft: `3px solid ${color}`,
              cursor: 'pointer',
              opacity: isHidden ? 0.4 : hovered && !active ? 0.55 : 1,
              filter: isHidden ? 'grayscale(0.7)' : undefined,
              transition: 'opacity 120ms, background 120ms',
            }}
          >
            <input
              type="checkbox"
              checked={!isHidden}
              onChange={() => onToggleVisible(p.driver.id)}
              onClick={(e) => e.stopPropagation()}
              title={isHidden ? 'Show on chart' : 'Hide from chart'}
              style={{ accentColor: color, cursor: 'pointer', margin: 0 }}
            />
            <span style={{ fontWeight: 700, fontSize: 13 }}>{p.rankAtCutoff}</span>
            {isConstructors ? (
              <TeamIcon team={p.team} size={30} />
            ) : (
              <DriverAvatar driver={p.driver} teamId={p.team.id} size={30} />
            )}
            <span style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                {p.driver.firstName}{' '}
                <span style={{ textTransform: isConstructors ? 'none' : 'uppercase' }}>
                  {p.driver.lastName}
                </span>
              </span>
              {!isConstructors && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    color: UI.textDim,
                  }}
                >
                  <TeamIcon team={p.team} size={13} />
                  {p.team.name}
                </span>
              )}
            </span>
            <span style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
              {p.pointsAtCutoff}
            </span>
            <span style={{ textAlign: 'right', fontSize: 12, color: UI.textDim }}>
              {titleLocked ? (
                <b style={{ color: '#FFD700' }}>CHAMPION</b>
              ) : p.bestFinalRank === p.worstFinalRank ? (
                <b style={{ color: UI.text }}>P{p.bestFinalRank}</b>
              ) : (
                <>
                  P{p.bestFinalRank}–P{p.worstFinalRank}
                </>
              )}
              <span style={{ display: 'block', fontSize: 10 }}>
                max {p.maxFinal} pts
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
