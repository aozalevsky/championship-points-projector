import { useEffect } from 'react';
import { UI, teamColor } from '../theme';
import { DriverAvatar } from './Icons';
import type { SeasonModel } from '../types';

interface Props {
  /** drivers model (classifications are per driver/rider) */
  model: SeasonModel;
  segIndex: number;
  onClose: () => void;
  onNavigate: (segIndex: number) => void;
}

export function Results({ model, segIndex, onClose, onNavigate }: Props) {
  const seg = model.segments[segIndex];
  const rows = model.resultsBySegment?.[segIndex];

  // index drivers for name/team lookup
  const byId = new Map(model.drivers.map((d) => [d.driver.id, d]));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && segIndex > 0) onNavigate(segIndex - 1);
      if (e.key === 'ArrowRight' && segIndex < model.segments.length - 1) onNavigate(segIndex + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [segIndex, model.segments.length, onClose, onNavigate]);

  const date = new Date(`${seg.date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const navBtn: React.CSSProperties = {
    background: 'transparent',
    color: UI.textDim,
    border: `1px solid ${UI.panelBorder}`,
    borderRadius: 6,
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 14,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: UI.panel,
          border: `1px solid ${UI.panelBorder}`,
          borderRadius: 12,
          width: 540,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 22px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          {seg.flag && <span style={{ fontSize: 22 }}>{seg.flag}</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {seg.raceName}
              {seg.type === 'sprint' && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 10,
                    fontWeight: 700,
                    color: UI.bg,
                    background: UI.textDim,
                    borderRadius: 4,
                    padding: '1px 6px',
                    verticalAlign: 'middle',
                  }}
                >
                  SPRINT
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: UI.textDim }}>
              Round {seg.round} · {date} · {seg.circuit}
            </div>
          </div>
          <button
            onClick={() => onNavigate(segIndex - 1)}
            disabled={segIndex === 0}
            style={{ ...navBtn, opacity: segIndex === 0 ? 0.35 : 1 }}
            title="Previous event (←)"
          >
            ‹
          </button>
          <button
            onClick={() => onNavigate(segIndex + 1)}
            disabled={segIndex === model.segments.length - 1}
            style={{ ...navBtn, opacity: segIndex === model.segments.length - 1 ? 0.35 : 1 }}
            title="Next event (→)"
          >
            ›
          </button>
          <button onClick={onClose} style={navBtn} title="Close (Esc)">
            ✕
          </button>
        </div>

        <div style={{ overflowY: 'auto', marginTop: 12 }}>
          {!rows || rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: UI.textDim, fontSize: 13 }}>
              No results yet — this event hasn't been run (or scored).
            </div>
          ) : (
            rows.map((r, i) => {
              const d = byId.get(r.driverId);
              const team = d ? (d.teamBySegment[segIndex] ?? d.team) : null;
              const color = team ? teamColor(team.id) : UI.textDim;
              return (
                <div
                  key={`${r.driverId}-${i}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '30px 30px 1fr 90px 44px',
                    gap: 8,
                    alignItems: 'center',
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: i % 2 ? 'transparent' : UI.bg,
                    borderLeft: `3px solid ${color}`,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{r.position ?? '–'}</span>
                  {d ? (
                    <DriverAvatar driver={d.driver} teamId={team?.id ?? ''} size={24} />
                  ) : (
                    <span />
                  )}
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d ? `${d.driver.firstName} ${d.driver.lastName}`.trim() : r.driverId}
                    {r.status && (
                      <span style={{ color: UI.textDim, fontSize: 11, marginLeft: 7 }}>
                        {r.status}
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      color: UI.textDim,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {team?.name ?? ''}
                  </span>
                  <span style={{ textAlign: 'right', fontWeight: r.points > 0 ? 700 : 400, color: r.points > 0 ? UI.text : UI.textDim }}>
                    {r.points > 0 ? `+${r.points}` : '0'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
