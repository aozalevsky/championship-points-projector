import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import { UI, dashFor, teamColor } from '../theme';
import type { DriverProjection, SeasonModel } from '../types';

const MARGIN = { top: 16, right: 200, bottom: 64, left: 48 };
const HEIGHT = 640;

interface Props {
  model: SeasonModel;
  projections: DriverProjection[];
  cutoff: number;
  hovered: string | null;
  onHover: (driverId: string | null) => void;
  onCutoffChange: (cutoff: number) => void;
  /** rescale the y axis to the current cutoff's max instead of the season max */
  autoScaleY: boolean;
  onSegmentClick: (segIndex: number) => void;
}

export function Chart({
  model,
  projections,
  cutoff,
  hovered,
  onHover,
  onCutoffChange,
  autoScaleY,
  onSegmentClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(960);
  const [dragging, setDragging] = useState(false);
  const [hoveredSeg, setHoveredSeg] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setWidth(Math.max(640, entries[0].contentRect.width));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const nSeg = model.segments.length;

  const x = useMemo(
    () => scaleLinear().domain([0, nSeg]).range([0, innerW]),
    [nSeg, innerW],
  );
  // fixed scale = the most points anyone could take from the whole season,
  // so the axis stays put while scrubbing; auto = tight fit to current cutoff
  const seasonMax = useMemo(
    () => model.segments.reduce((sum, s) => sum + s.maxPoints, 0),
    [model],
  );
  const yMax = useMemo(
    () =>
      autoScaleY ? Math.max(10, ...projections.map((p) => p.maxFinal)) : Math.max(10, seasonMax),
    [autoScaleY, projections, seasonMax],
  );
  // axis tops out exactly at the highest theoretically attainable total
  const y = useMemo(
    () => scaleLinear().domain([0, yMax]).range([innerH, 0]),
    [yMax, innerH],
  );
  const yTicks = useMemo(() => {
    const ticks = y.ticks(8).filter((t) => y(t) > 14); // leave room for the max label
    return [...ticks, yMax];
  }, [y, yMax]);

  // dash style per driver: 2nd car of a team gets dashes
  const dashByDriver = useMemo(() => {
    const seen = new Map<string, number>();
    const map = new Map<string, string | undefined>();
    for (const p of projections) {
      const n = seen.get(p.team.id) ?? 0;
      seen.set(p.team.id, n + 1);
      map.set(p.driver.id, dashFor(n));
    }
    return map;
  }, [projections]);

  // right-edge labels with collision resolution, clamped to the canvas:
  // shrink the gap if the field doesn't fit, push down from the top, then
  // push back up from the bottom — order is preserved and 0 ≤ y ≤ innerH
  const labels = useMemo(() => {
    const items = projections.map((p) => ({
      p,
      target: y((p.minFinal + p.maxFinal) / 2),
      yPos: 0,
    }));
    items.sort((a, b) => a.target - b.target);
    const gap = Math.min(15, innerH / Math.max(1, items.length - 1));
    let prev = -gap;
    for (const it of items) {
      it.yPos = Math.max(it.target, prev + gap);
      prev = it.yPos;
    }
    let next = innerH + gap;
    for (let i = items.length - 1; i >= 0; i--) {
      items[i].yPos = Math.min(items[i].yPos, next - gap);
      next = items[i].yPos;
    }
    return items;
  }, [projections, y, innerH]);

  const hoveredProj = hovered ? projections.find((p) => p.driver.id === hovered) : null;

  // monotone splines: smooth but never overshoot, so cumulative totals
  // are never drawn dipping or exceeding the true min/max bounds
  const smoothLine = useMemo(
    () => line<[number, number]>().curve(curveMonotoneX),
    [],
  );

  const pastPath = (p: DriverProjection): string => {
    const pts: [number, number][] = [[x(0), y(0)]];
    p.actualCumulative.forEach((v, i) => pts.push([x(i + 1), y(v)]));
    return smoothLine(pts) ?? '';
  };

  const bandPath = (p: DriverProjection): string => {
    if (p.maxCumulative.length === 0) return '';
    const pts: [number, number][] = [[x(cutoff), p.pointsAtCutoff]];
    p.maxCumulative.forEach((v, j) => pts.push([x(cutoff + 1 + j), v]));
    const gen = area<[number, number]>()
      .x((d) => d[0])
      .y1((d) => y(d[1]))
      .y0(y(p.minFinal))
      .curve(curveMonotoneX);
    return gen(pts) ?? '';
  };

  const opacityFor = (id: string, base: number, active: number) =>
    hovered === null ? base : hovered === id ? active : base * 0.22;

  const cutoffFromPointer = (clientX: number): number => {
    const svg = svgRef.current;
    if (!svg) return cutoff;
    const px = clientX - svg.getBoundingClientRect().left - MARGIN.left;
    const idx = Math.round(x.invert(px));
    return Math.max(0, Math.min(model.completedCount, idx));
  };

  const startDrag = (e: React.PointerEvent<SVGElement>) => {
    e.preventDefault();
    (e.target as SVGElement).setPointerCapture(e.pointerId);
    setDragging(true);
    onCutoffChange(cutoffFromPointer(e.clientX));
  };

  const moveDrag = (e: React.PointerEvent<SVGElement>) => {
    if (!dragging) return;
    const next = cutoffFromPointer(e.clientX);
    if (next !== cutoff) onCutoffChange(next);
  };

  const endDrag = () => setDragging(false);

  // draw in reverse championship order so the leader ends up on top
  const drawOrder = [...projections].reverse();

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg ref={svgRef} width={width} height={HEIGHT} style={{ display: 'block' }}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* sprint columns */}
          {model.segments.map((s, i) =>
            s.type === 'sprint' ? (
              <rect
                key={s.key}
                x={x(i + 0.5)}
                y={0}
                width={x(1) - x(0.5)}
                height={innerH}
                fill="#FFFFFF"
                opacity={0.025}
              />
            ) : null,
          )}

          {/* gridlines + y axis (top line = max theoretical points) */}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={0}
                x2={innerW}
                y1={y(t)}
                y2={y(t)}
                stroke={t === yMax ? UI.textDim : UI.grid}
                strokeWidth={1}
                strokeDasharray={t === yMax ? '2 3' : undefined}
              />
              <text
                x={-10}
                y={y(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill={UI.textDim}
                fontWeight={t === yMax ? 700 : 400}
              >
                {t}
              </text>
            </g>
          ))}

          {/* x axis ticks: season start (true zero), then one per event */}
          <g transform={`translate(${x(0)},${innerH})`}>
            <line y1={0} y2={4} stroke={UI.textDim} strokeWidth={1} />
            <text
              transform="translate(0,8) rotate(-55)"
              textAnchor="end"
              fontSize={10.5}
              fontWeight={600}
              fontStyle="italic"
              fill={UI.textDim}
            >
              Start
            </text>
          </g>
          {model.segments.map((s, i) => (
            <g
              key={s.key}
              transform={`translate(${x(i + 1)},${innerH})`}
              onMouseEnter={() => setHoveredSeg(i)}
              onMouseLeave={() => setHoveredSeg(null)}
              onClick={() => onSegmentClick(i)}
              style={{ cursor: 'pointer' }}
            >
              <line y1={0} y2={4} stroke={UI.textDim} strokeWidth={1} />
              <text
                transform="translate(0,8) rotate(-55)"
                textAnchor="end"
                fontSize={s.type === 'sprint' ? 9 : 10.5}
                fontWeight={s.type === 'sprint' ? 400 : 600}
                fill={hoveredSeg === i ? UI.red : i < cutoff ? UI.text : UI.textDim}
                opacity={s.type === 'sprint' ? 0.75 : 1}
              >
                {s.shortName}
              </text>
              {/* hit area covering the tick label zone */}
              <rect
                x={-(x(1) - x(0)) / 2}
                y={0}
                width={x(1) - x(0)}
                height={MARGIN.bottom}
                fill="transparent"
              />
            </g>
          ))}

          {/* uncertainty bands (future) */}
          {drawOrder.map((p) => (
            <path
              key={`band-${p.driver.id}`}
              d={bandPath(p)}
              fill={teamColor(p.team.id)}
              opacity={opacityFor(p.driver.id, 0.13, 0.45)}
              stroke={teamColor(p.team.id)}
              strokeOpacity={opacityFor(p.driver.id, 0.45, 1)}
              strokeWidth={1}
              strokeDasharray={dashByDriver.get(p.driver.id)}
              onMouseEnter={() => onHover(p.driver.id)}
              onMouseLeave={() => onHover(null)}
              style={{ cursor: 'pointer', transition: 'opacity 120ms' }}
            />
          ))}

          {/* actual cumulative lines (past) */}
          {drawOrder.map((p) => (
            <g key={`past-${p.driver.id}`}>
              <path
                d={pastPath(p)}
                fill="none"
                stroke={teamColor(p.team.id)}
                strokeWidth={hovered === p.driver.id ? 3 : 1.8}
                strokeDasharray={dashByDriver.get(p.driver.id)}
                opacity={opacityFor(p.driver.id, 0.9, 1)}
                style={{ transition: 'opacity 120ms' }}
              />
              {/* invisible fat line for easier hovering */}
              <path
                d={pastPath(p)}
                fill="none"
                stroke="transparent"
                strokeWidth={9}
                onMouseEnter={() => onHover(p.driver.id)}
                onMouseLeave={() => onHover(null)}
                style={{ cursor: 'pointer' }}
              />
            </g>
          ))}

          {/* draggable cutoff marker (on top of bands/lines so it stays grabbable) */}
          <g
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{ cursor: dragging ? 'grabbing' : 'ew-resize', touchAction: 'none' }}
          >
            {/* fat invisible hit area for grabbing */}
            <rect x={x(cutoff) - 9} y={0} width={18} height={innerH} fill="transparent" />
            <line
              x1={x(cutoff)}
              x2={x(cutoff)}
              y1={0}
              y2={innerH}
              stroke={UI.red}
              strokeWidth={dragging ? 2.5 : 1.5}
              strokeDasharray={dragging ? undefined : '4 4'}
            />
            <text
              x={x(cutoff)}
              y={-4}
              textAnchor="middle"
              fontSize={10}
              fill={UI.red}
              fontWeight={700}
            >
              {cutoff > 0 ? model.segments[cutoff - 1]?.shortName : 'Start'}
            </text>
            {/* grip handle */}
            <g transform={`translate(${x(cutoff)},${innerH / 2})`}>
              <rect x={-5.5} y={-15} width={11} height={30} rx={5.5} fill={UI.red} />
              <line x1={-1.7} x2={-1.7} y1={-7} y2={7} stroke="#fff" strokeWidth={1.2} opacity={0.85} />
              <line x1={1.7} x2={1.7} y1={-7} y2={7} stroke="#fff" strokeWidth={1.2} opacity={0.85} />
            </g>
          </g>

          {/* right-edge labels */}
          {labels.map(({ p, yPos }) => {
            const color = teamColor(p.team.id);
            const rankRange =
              p.bestFinalRank === p.worstFinalRank
                ? `P${p.bestFinalRank}`
                : `P${p.bestFinalRank}–P${p.worstFinalRank}`;
            return (
              <g
                key={`label-${p.driver.id}`}
                transform={`translate(${innerW + 8},${yPos})`}
                onMouseEnter={() => onHover(p.driver.id)}
                onMouseLeave={() => onHover(null)}
                style={{ cursor: 'pointer' }}
                opacity={opacityFor(p.driver.id, 1, 1)}
              >
                <line
                  x1={-8 - (innerW - x(nSeg))}
                  x2={-2}
                  y1={y((p.minFinal + p.maxFinal) / 2) - yPos}
                  y2={0}
                  stroke={color}
                  strokeWidth={1}
                  opacity={0.4}
                />
                <rect x={0} y={-6.5} width={4} height={13} rx={1} fill={color} />
                <text x={9} y={4} fontSize={11.5} fontWeight={700} fill={UI.text}>
                  {p.driver.code}
                </text>
                <text x={42} y={4} fontSize={11} fill={UI.textDim}>
                  {p.pointsAtCutoff} pts · {rankRange}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* track popup for x-axis hover */}
      {hoveredSeg !== null && (() => {
        const s = model.segments[hoveredSeg];
        const px = Math.min(Math.max(MARGIN.left + x(hoveredSeg + 1), 140), width - 140);
        const date = new Date(`${s.date}T12:00:00Z`).toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        return (
          <div
            style={{
              position: 'absolute',
              left: px,
              top: MARGIN.top + innerH - 10,
              transform: 'translate(-50%, -100%)',
              background: 'rgba(31,31,43,0.96)',
              border: `1px solid ${s.type === 'sprint' ? UI.textDim : UI.red}`,
              borderRadius: 8,
              padding: '9px 13px',
              pointerEvents: 'none',
              fontSize: 12.5,
              lineHeight: 1.55,
              whiteSpace: 'nowrap',
              zIndex: 2,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>
              {s.flag && <span style={{ marginRight: 7, fontSize: 15 }}>{s.flag}</span>}
              {s.raceName}
              {s.type === 'sprint' && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 10,
                    fontWeight: 700,
                    color: UI.bg,
                    background: UI.textDim,
                    borderRadius: 4,
                    padding: '1px 5px',
                    verticalAlign: 'middle',
                  }}
                >
                  SPRINT
                </span>
              )}
            </div>
            <div style={{ color: UI.textDim }}>
              Round {s.round} · {date}
              <br />
              {s.circuit}
              <br />
              {[s.locality, s.country].filter(Boolean).join(', ') || 'Location unknown'} · max{' '}
              {s.maxPoints} pts
            </div>
            <div style={{ color: UI.red, fontSize: 11, marginTop: 3, fontWeight: 600 }}>
              Click for full results
            </div>
          </div>
        );
      })()}

      {/* hover info box */}
      {hoveredProj && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: MARGIN.left + 10,
            background: 'rgba(31,31,43,0.95)',
            border: `1px solid ${teamColor(hoveredProj.team.id)}`,
            borderRadius: 8,
            padding: '10px 14px',
            pointerEvents: 'none',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700 }}>
            {`${hoveredProj.driver.firstName} ${hoveredProj.driver.lastName}`.trim()}
            {hoveredProj.team.name !== hoveredProj.driver.lastName && (
              <span style={{ color: teamColor(hoveredProj.team.id), marginLeft: 8 }}>
                {hoveredProj.team.name}
              </span>
            )}
          </div>
          <div style={{ color: UI.textDim }}>
            Now: <b style={{ color: UI.text }}>P{hoveredProj.rankAtCutoff}</b> ·{' '}
            {hoveredProj.pointsAtCutoff} pts
            <br />
            Season end: <b style={{ color: UI.text }}>
              {hoveredProj.minFinal}–{hoveredProj.maxFinal} pts
            </b>{' '}
            → P{hoveredProj.bestFinalRank}
            {hoveredProj.worstFinalRank !== hoveredProj.bestFinalRank &&
              `–P${hoveredProj.worstFinalRank}`}
          </div>
        </div>
      )}
    </div>
  );
}
