import { useEffect, useMemo, useState } from 'react';
import { projectSeason } from './data/model';
import { SERIES, seriesById, type SeriesId } from './data/series';
import { Chart } from './components/Chart';
import { Standings } from './components/Standings';
import { About } from './components/About';
import { Results } from './components/Results';
import { Logo } from './components/Logo';
import { UI } from './theme';
import type { SeasonBundle } from './types';

const CURRENT_SEASON = new Date().getFullYear();

type LoadState =
  | { key: string; status: 'ready'; bundle: SeasonBundle }
  | { key: string; status: 'error'; message: string };

export default function App() {
  const [seriesId, setSeriesId] = useState<SeriesId>('f1');
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [reloadKey, setReloadKey] = useState(0);
  const [load, setLoad] = useState<LoadState | null>(null);
  const [progressMsg, setProgressMsg] = useState<{ key: string; msg: string } | null>(null);
  // user-chosen cutoff, tied to the load it was chosen for
  const [cutoffChoice, setCutoffChoice] = useState<{ key: string; value: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [autoScaleY, setAutoScaleY] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [championship, setChampionship] = useState<'drivers' | 'constructors'>('drivers');
  // open results modal, tied to the load it was opened for
  const [resultsSeg, setResultsSeg] = useState<{ key: string; index: number } | null>(null);

  const series = seriesById(seriesId);
  const seasons = useMemo(
    () =>
      Array.from(
        { length: CURRENT_SEASON - series.firstSeason + 1 },
        (_, i) => CURRENT_SEASON - i,
      ),
    [series],
  );
  const requestKey = `${seriesId}:${season}:${reloadKey}`;

  useEffect(() => {
    let cancelled = false;
    series
      .loadSeason(season, (msg) => {
        if (!cancelled) setProgressMsg({ key: requestKey, msg });
      })
      .then((bundle) => {
        if (!cancelled) setLoad({ key: requestKey, status: 'ready', bundle });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoad({
          key: requestKey,
          status: 'error',
          message: e instanceof Error ? e.message : String(e),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [series, season, requestKey]);

  const progress = progressMsg && progressMsg.key === requestKey ? progressMsg.msg : '';
  const current = load && load.key === requestKey ? load : null;
  const loading = current === null;
  const bundle = current?.status === 'ready' ? current.bundle : null;
  const error = current?.status === 'error' ? current.message : null;
  const hasConstructors = bundle?.constructors != null;
  const model =
    championship === 'constructors' && bundle?.constructors
      ? bundle.constructors
      : (bundle?.drivers ?? null);

  const effectiveCutoff = useMemo(() => {
    if (!model) return 0;
    if (cutoffChoice && cutoffChoice.key === requestKey) {
      return Math.min(cutoffChoice.value, model.completedCount);
    }
    // default cutoff: latest completed event for a live season; for a
    // finished season, rewind to ~75% so the uncertainty fan is visible
    const seasonOver = model.completedCount === model.segments.length;
    return seasonOver
      ? Math.max(1, Math.round(model.completedCount * 0.75))
      : model.completedCount;
  }, [model, cutoffChoice, requestKey]);

  const projections = useMemo(
    () => (model ? projectSeason(model, effectiveCutoff) : []),
    [model, effectiveCutoff],
  );

  const cutoffSegment =
    model && effectiveCutoff > 0 ? model.segments[effectiveCutoff - 1] : null;
  const remaining = model ? model.segments.length - effectiveCutoff : 0;

  const selectStyle: React.CSSProperties = {
    background: UI.panel,
    color: UI.text,
    border: `1px solid ${UI.panelBorder}`,
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 14,
    fontWeight: 600,
  };

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto', padding: '0 20px 40px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '18px 0 14px',
          borderBottom: `1px solid ${UI.panelBorder}`,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <Logo size={38} />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '0.01em' }}>
          Championship Points Projector
        </h1>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 13, color: UI.textDim }}>
          Series{' '}
          <select
            value={seriesId}
            onChange={(e) => {
              const id = e.target.value as SeriesId;
              setSeriesId(id);
              const def = seriesById(id);
              setSeason((s) => Math.min(Math.max(s, def.firstSeason), CURRENT_SEASON));
            }}
            style={selectStyle}
          >
            {SERIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13, color: UI.textDim }}>
          Season{' '}
          <select value={season} onChange={(e) => setSeason(+e.target.value)} style={selectStyle}>
            {seasons.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            series.clearCache(season);
            setReloadKey((k) => k + 1);
          }}
          title="Re-fetch results from the API"
          style={{
            background: 'transparent',
            color: UI.textDim,
            border: `1px solid ${UI.panelBorder}`,
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ⟳ Refresh
        </button>
        <button
          onClick={() => setShowAbout(true)}
          style={{
            background: 'transparent',
            color: UI.textDim,
            border: `1px solid ${UI.panelBorder}`,
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          About
        </button>
        <a
          href="https://github.com/aozalevsky/championship-points-projector"
          target="_blank"
          rel="noopener noreferrer"
          title="Source code on GitHub (MIT)"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: UI.textDim,
            border: `1px solid ${UI.panelBorder}`,
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          Source
        </a>
      </header>

      {showAbout && <About onClose={() => setShowAbout(false)} />}

      {resultsSeg && resultsSeg.key === requestKey && bundle && (
        <Results
          model={bundle.drivers}
          segIndex={resultsSeg.index}
          onClose={() => setResultsSeg(null)}
          onNavigate={(index) => setResultsSeg({ key: requestKey, index })}
        />
      )}

      {loading && !error && (
        <div style={{ padding: 60, textAlign: 'center', color: UI.textDim }}>
          Loading {series.label} {season} season data…
          {progress && (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>{progress}</div>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '26px 30px',
            background: UI.panel,
            borderRadius: 10,
            border: `1px solid ${UI.red}`,
            maxWidth: 720,
            margin: '40px auto',
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            ⚠ {series.label} {season} data is not available
          </div>
          <div style={{ fontSize: 13, color: UI.textDim }}>
            Could not load results from the {series.sourceName}.
            <br />
            {series.fallbackHint}
          </div>
          <div
            style={{
              fontSize: 12,
              color: UI.textDim,
              background: UI.bg,
              borderRadius: 6,
              padding: '8px 10px',
              margin: '12px 0',
              fontFamily: 'monospace',
            }}
          >
            {error}
          </div>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            style={{
              background: UI.red,
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {model && !loading && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: UI.panel,
              border: `1px solid ${UI.panelBorder}`,
              borderRadius: 10,
              padding: '10px 16px',
              marginBottom: 14,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ display: 'inline-flex', borderRadius: 7, overflow: 'hidden' }}>
              {(['drivers', 'constructors'] as const).map((c) => {
                const active = championship === c && (c === 'drivers' || hasConstructors);
                const disabled = c === 'constructors' && !hasConstructors;
                return (
                  <button
                    key={c}
                    onClick={() => setChampionship(c)}
                    disabled={disabled}
                    title={
                      disabled
                        ? 'No constructors’ championship was contested this season'
                        : undefined
                    }
                    style={{
                      background: active ? UI.red : UI.bg,
                      color: active ? '#fff' : disabled ? '#55555f' : UI.textDim,
                      border: `1px solid ${UI.panelBorder}`,
                      padding: '5px 12px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {c === 'drivers' ? `${series.entityWord}s` : 'Constructors'}
                  </button>
                );
              })}
            </span>
            <span style={{ fontSize: 13, color: UI.textDim, whiteSpace: 'nowrap' }}>
              Standings after
            </span>
            <input
              type="range"
              min={0}
              max={model.completedCount}
              value={effectiveCutoff}
              onChange={(e) => setCutoffChoice({ key: requestKey, value: +e.target.value })}
              style={{ flex: 1, minWidth: 200, accentColor: UI.red }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 230 }}>
              {cutoffSegment
                ? `${cutoffSegment.raceName}${cutoffSegment.type === 'sprint' ? ' (Sprint)' : ''}`
                : 'Season start'}
              <span style={{ color: UI.textDim, fontWeight: 400 }}>
                {' '}
                · {remaining} event{remaining === 1 ? '' : 's'} left
              </span>
            </span>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: UI.textDim,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <input
                type="checkbox"
                checked={autoScaleY}
                onChange={(e) => setAutoScaleY(e.target.checked)}
                style={{ accentColor: UI.red }}
              />
              Auto-adjust Y scale
            </label>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(640px, 1fr) 380px',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <div
              style={{
                background: UI.panel,
                border: `1px solid ${UI.panelBorder}`,
                borderRadius: 10,
                padding: '12px 8px 4px',
              }}
            >
              <Chart
                model={model}
                projections={projections}
                cutoff={effectiveCutoff}
                hovered={hovered}
                onHover={setHovered}
                onCutoffChange={(v) => setCutoffChoice({ key: requestKey, value: v })}
                autoScaleY={autoScaleY}
                onSegmentClick={(index) => setResultsSeg({ key: requestKey, index })}
              />
            </div>
            <Standings
              projections={projections}
              hovered={hovered}
              onHover={setHovered}
              entityLabel={
                championship === 'constructors' && hasConstructors
                  ? 'Constructor'
                  : series.entityWord
              }
              isConstructors={championship === 'constructors' && hasConstructors}
            />
          </div>

          <footer style={{ marginTop: 18, fontSize: 12, color: UI.textDim, lineHeight: 1.7 }}>
            <b style={{ color: UI.text }}>
              {series.label} {season} scoring:
            </b>{' '}
            {model.scoringNote}
            <br />
            Shaded bands show each rider's possible cumulative points across upcoming events
            (sprints are separate, narrower steps): the lower edge assumes zero points scored,
            the upper edge assumes maximum points in every remaining event. Final-position
            ranges (P-best to P-worst) are derived from these bounds; ties are counted
            pessimistically.
            <br />
            Caveats: projections assume all scheduled events take place (cancelled races would
            tighten the ranges) and full points are awarded. Results sourced from the{' '}
            <a href={series.sourceUrl} style={{ color: UI.textDim }}>
              {series.sourceName}
            </a>
            . Driver and team icons are generated — no official logos or likenesses are used.
          </footer>
        </>
      )}
    </div>
  );
}
