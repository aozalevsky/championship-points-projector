/**
 * Adapter for the unofficial motogp.com results API (api.motogp.pulselive.com).
 * Not affiliated with Dorna Sports. The API rejects requests that carry a
 * browser Origin header, so in the browser we go through the local dev-server
 * proxy (/api/motogp, see vite.config.ts); any failure surfaces as a normal
 * error and the app shows its "data unavailable" fallback.
 */

import { flagFromIso, makeStandaloneEntity } from './model';
import type {
  DriverSeason,
  SeasonBundle,
  SeasonModel,
  Segment,
  SegmentResult,
  TeamInfo,
} from '../types';

const BASE =
  typeof window === 'undefined'
    ? 'https://api.motogp.pulselive.com/motogp/v1' // node scripts hit the API directly
    : '/api/motogp';

const CACHE_PREFIX = 'f1u:motogp:v3:';

export type MotoSeriesId = 'motogp' | 'moto2' | 'moto3';

interface MotoSeriesSpec {
  /** category name fragments to match, in order of preference */
  categoryNames: string[];
  firstSeason: number;
  sprintsSince: number | null;
  scoringNote: string;
}

export const MOTO_SERIES: Record<MotoSeriesId, MotoSeriesSpec> = {
  motogp: {
    categoryNames: ['MotoGP', '500cc'],
    firstSeason: 1949,
    sprintsSince: 2023,
    scoringNote:
      'Top 15 score 25–1. Since 2023 every GP has a Saturday sprint: top 9 score 12–1. Older premier-class (500cc) seasons used era-specific tables — projections assume the modern maximum.',
  },
  moto2: {
    categoryNames: ['Moto2'],
    firstSeason: 2010,
    sprintsSince: null,
    scoringNote: 'Top 15 score 25–1. No sprint races.',
  },
  moto3: {
    categoryNames: ['Moto3'],
    firstSeason: 2012,
    sprintsSince: null,
    scoringNote: 'Top 15 score 25–1. No sprint races.',
  },
};

const MAX_RACE_POINTS = 25;
const MAX_SPRINT_POINTS = 12;

// ---- raw API shapes (subset) ----

interface ApiSeason {
  id: string;
  year: number;
}

interface ApiCategory {
  id: string;
  name: string;
}

interface ApiEvent {
  id: string;
  name: string;
  short_name: string;
  test: boolean;
  status: 'FINISHED' | 'NOT-STARTED' | string;
  date_start: string;
  date_end: string;
  circuit?: { name?: string; place?: string };
  country?: { iso?: string; name?: string };
}

interface ApiSession {
  id: string;
  type: string; // RAC, SPR, FP, Q...
  date: string;
}

interface ApiClassificationRow {
  position: number | null;
  points: number | null;
  status?: string;
  rider: { full_name: string; number: number | null };
  team: { id: string; name: string } | null;
  constructor: { id: string; name: string } | null;
}

// ---- fetching ----

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(path: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}`);
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(1200 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`motogp API request failed (${res.status}) for ${path}`);
    return (await res.json()) as T;
  }
}

function cacheGet(key: string, maxAgeMs: number): unknown | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as { t: number; v: unknown };
    if (Date.now() - t > maxAgeMs) return null;
    return v;
  } catch {
    return null;
  }
}

function cacheSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    /* storage unavailable/full — skip caching */
  }
}

export function clearMotoCache(series: MotoSeriesId, season: number): void {
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${series}:${season}`);
    localStorage.removeItem(`${CACHE_PREFIX}seasons`);
  } catch {
    /* ignore */
  }
}

const SMALL_WORDS = new Set(['of', 'the', 'and', 'de', 'la', 'del', 'da', 'di']);

/** Unicode-safe title case for SHOUTING event names from the API. */
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

// ---- rider codes: 3 letters, disambiguated like MM/AM for the Marquez brothers ----

function riderCodes(fullNames: string[]): Map<string, string> {
  const parts = fullNames.map((n) => {
    const words = n.trim().split(/\s+/);
    return { full: n, first: words[0] ?? '', last: words[words.length - 1] ?? n };
  });
  const codes = new Map<string, string>();
  const used = new Map<string, number>();
  for (const p of parts) {
    const base = p.last.slice(0, 3).toUpperCase().padEnd(3, 'X');
    used.set(base, (used.get(base) ?? 0) + 1);
    codes.set(p.full, base);
  }
  for (const p of parts) {
    const base = p.last.slice(0, 3).toUpperCase().padEnd(3, 'X');
    if ((used.get(base) ?? 0) > 1) {
      codes.set(p.full, (p.first[0] + p.last.slice(0, 2)).toUpperCase());
    }
  }
  return codes;
}

// ---- main loader ----

export async function loadMotoSeason(
  series: MotoSeriesId,
  season: number,
  onProgress?: (message: string) => void,
): Promise<SeasonBundle> {
  const spec = MOTO_SERIES[series];
  const now = new Date();
  const finished = season < now.getFullYear();
  const maxAge = finished ? Infinity : 60 * 60 * 1000;

  const cached = cacheGet(`${series}:${season}`, maxAge);
  if (cached) return cached as SeasonBundle;

  onProgress?.('Looking up season…');
  const seasons = await getJson<ApiSeason[]>('/results/seasons');
  const seasonEntry = seasons.find((s) => s.year === season);
  if (!seasonEntry) throw new Error(`season ${season} not found in the motogp API`);

  const categories = await getJson<ApiCategory[]>(
    `/results/categories?seasonUuid=${seasonEntry.id}`,
  );
  const category = spec.categoryNames
    .map((frag) => categories.find((c) => c.name.toLowerCase().includes(frag.toLowerCase())))
    .find(Boolean);
  if (!category) {
    throw new Error(
      `no ${spec.categoryNames[0]} class in the ${season} season (classes: ${categories
        .map((c) => c.name.replace('™', ''))
        .join(', ')})`,
    );
  }

  const allEvents = await getJson<ApiEvent[]>(`/results/events?seasonUuid=${seasonEntry.id}`);
  const events = allEvents
    .filter((e) => !e.test)
    .sort((a, b) => a.date_start.localeCompare(b.date_start));
  if (events.length === 0) throw new Error(`no events found for the ${season} season`);

  interface SegmentResults {
    segment: Segment;
    rows: ApiClassificationRow[]; // empty = not yet run
  }
  const collected: SegmentResults[] = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const round = i + 1;
    const base = {
      round,
      raceName: titleCase(ev.name),
      country: ev.country?.name ?? '',
      locality: ev.circuit?.place ?? '',
      circuit: ev.circuit?.name ?? '',
      flag: flagFromIso(ev.country?.iso ?? ''),
    };
    const code = (ev.short_name || base.country.slice(0, 3)).toUpperCase();
    const expectSprint = spec.sprintsSince !== null && season >= spec.sprintsSince;

    if (ev.status !== 'FINISHED') {
      // upcoming event: schedule-only segments
      if (expectSprint) {
        collected.push({
          rows: [],
          segment: {
            ...base,
            key: `${round}-sprint`,
            type: 'sprint',
            shortName: `${code} S`,
            date: ev.date_start,
            maxPoints: MAX_SPRINT_POINTS,
            completed: false,
          },
        });
      }
      collected.push({
        rows: [],
        segment: {
          ...base,
          key: `${round}-race`,
          type: 'race',
          shortName: code,
          date: ev.date_end,
          maxPoints: MAX_RACE_POINTS,
          completed: false,
        },
      });
      continue;
    }

    onProgress?.(`Loading results ${round}/${events.length} — ${base.raceName}`);
    const sessions = await getJson<ApiSession[]>(
      `/results/sessions?eventUuid=${ev.id}&categoryUuid=${category.id}`,
    );

    const fetchRows = async (sessionId: string): Promise<ApiClassificationRow[]> => {
      const data = await getJson<{ classification?: ApiClassificationRow[] }>(
        `/results/session/${sessionId}/classification?test=false`,
      );
      return data.classification ?? [];
    };

    // a red-flagged race can leave two sessions of the same type; only the
    // (re)started one carries points — prefer the points-bearing classification
    const fetchTypeRows = async (
      type: string,
    ): Promise<{ rows: ApiClassificationRow[]; date?: string } | null> => {
      const matches = sessions
        .filter((s) => s.type === type)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
      if (matches.length === 0) return null;
      let rows: ApiClassificationRow[] = [];
      let date = matches[0].date;
      for (const m of matches) {
        const r = await fetchRows(m.id);
        if (r.some((row) => (row.points ?? 0) > 0) || rows.length === 0) {
          rows = r;
          date = m.date;
        }
      }
      return { rows, date };
    };

    const sprint = await fetchTypeRows('SPR');
    if (sprint) {
      collected.push({
        rows: sprint.rows,
        segment: {
          ...base,
          key: `${round}-sprint`,
          type: 'sprint',
          shortName: `${code} S`,
          date: sprint.date?.slice(0, 10) ?? ev.date_start,
          maxPoints: MAX_SPRINT_POINTS,
          completed: true, // refined below from rows
        },
      });
    } else if (expectSprint) {
      // finished event that should have had a sprint (e.g. cancelled Saturday)
      collected.push({
        rows: [],
        segment: {
          ...base,
          key: `${round}-sprint`,
          type: 'sprint',
          shortName: `${code} S`,
          date: ev.date_start,
          maxPoints: MAX_SPRINT_POINTS,
          completed: false,
        },
      });
    }
    const race = await fetchTypeRows('RAC');
    collected.push({
      rows: race?.rows ?? [],
      segment: {
        ...base,
        key: `${round}-race`,
        type: 'race',
        shortName: code,
        date: race?.date?.slice(0, 10) ?? ev.date_end,
        maxPoints: MAX_RACE_POINTS,
        completed: true,
      },
    });
    await sleep(120); // be polite to the API
  }

  for (const c of collected) c.segment.completed = c.rows.length > 0;

  // completed prefix, same convention as F1
  let completedCount = 0;
  while (completedCount < collected.length && collected[completedCount].segment.completed) {
    completedCount++;
  }

  // ---- per-rider points ----
  const teamInfo = new Map<string, TeamInfo>();
  const riderNames = new Map<string, { name: string; number: number | null }>();
  const points = new Map<string, number[]>();
  const teams = new Map<string, (TeamInfo | null)[]>();

  collected.slice(0, completedCount).forEach(({ rows }, segIdx) => {
    for (const row of rows) {
      const name = row.rider.full_name;
      if (!riderNames.has(name)) {
        riderNames.set(name, { name, number: row.rider.number });
        points.set(name, new Array(completedCount).fill(0));
        teams.set(name, new Array(completedCount).fill(null));
      }
      if (row.team && !teamInfo.has(row.team.id)) {
        teamInfo.set(row.team.id, { id: row.team.id, name: row.team.name });
      }
      points.get(name)![segIdx] += row.points ?? 0;
      if (row.team) teams.get(name)![segIdx] = teamInfo.get(row.team.id)!;
    }
  });

  const codes = riderCodes([...riderNames.keys()]);
  const drivers: DriverSeason[] = [...riderNames.values()].map(({ name, number }) => {
    const words = name.trim().split(/\s+/);
    const pointsBySegment = points.get(name)!;
    const teamBySegment = teams.get(name)!;
    const lastTeam = [...teamBySegment].reverse().find((t) => t !== null);
    return {
      driver: {
        id: name,
        code: codes.get(name) ?? name.slice(0, 3).toUpperCase(),
        firstName: words.slice(0, -1).join(' '),
        lastName: words[words.length - 1] ?? name,
        number: number != null ? String(number) : undefined,
      },
      pointsBySegment,
      teamBySegment,
      team: lastTeam ?? { id: 'unknown', name: 'Unknown' },
      totalPoints: pointsBySegment.reduce((a, b) => a + b, 0),
    };
  });
  drivers.sort((a, b) => b.totalPoints - a.totalPoints);

  // Post-race penalties sometimes only appear in the official standings while
  // the per-session classifications stay stale (e.g. a retroactive DSQ).
  // Reconcile each rider's total against the standings, applying any
  // difference at the latest completed event.
  if (completedCount > 0) {
    try {
      const standings = await getJson<{
        classification?: { rider: { full_name: string }; points: number }[];
      }>(`/results/standings?seasonUuid=${seasonEntry.id}&categoryUuid=${category.id}`);
      const official = new Map(
        (standings.classification ?? []).map((r) => [r.rider.full_name, r.points]),
      );
      if (official.size > 0) {
        for (const d of drivers) {
          const target = official.get(d.driver.id);
          if (target !== undefined && target !== d.totalPoints) {
            d.pointsBySegment[completedCount - 1] += target - d.totalPoints;
            d.totalPoints = target;
          }
        }
        drivers.sort((a, b) => b.totalPoints - a.totalPoints);
      }
    } catch {
      // standings endpoint unavailable — keep the classification sums
    }
  }

  const resultsBySegment: SegmentResult[][] = collected
    .slice(0, completedCount)
    .map(({ rows }) =>
      rows.map((row) => ({
        driverId: row.rider.full_name,
        position: row.position ?? null,
        points: row.points ?? 0,
        // the API uses opaque codes here; INSTND just means "classified"
        status: row.status && row.status !== 'INSTND' ? row.status : undefined,
      })),
    );

  const model: SeasonModel = {
    season,
    segments: collected.map((c) => c.segment),
    completedCount,
    drivers,
    teams: [...teamInfo.values()],
    scoringNote: spec.scoringNote,
    resultsBySegment,
  };

  // ---- constructors' championship: only the best-placed bike of each
  // constructor scores, in races and sprints alike (so maxima are unchanged) ----
  const ctorNames = new Map<string, string>();
  const ctorPoints = new Map<string, number[]>();
  collected.slice(0, completedCount).forEach(({ rows }, segIdx) => {
    for (const row of rows) {
      if (!row.constructor) continue;
      if (!ctorNames.has(row.constructor.id)) {
        ctorNames.set(row.constructor.id, row.constructor.name);
        ctorPoints.set(row.constructor.id, new Array(completedCount).fill(0));
      }
      const arr = ctorPoints.get(row.constructor.id)!;
      arr[segIdx] = Math.max(arr[segIdx], row.points ?? 0);
    }
  });
  const ctorEntries = [...ctorNames]
    .map(([id, name]) => makeStandaloneEntity(id, name, ctorPoints.get(id)!))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const constructorsModel: SeasonModel = {
    season,
    segments: collected.map((c) => c.segment),
    completedCount,
    drivers: ctorEntries,
    teams: ctorEntries.map((e) => e.team),
    scoringNote:
      'Constructors’ championship: only the best-placed bike of each constructor scores, in every race and sprint. The official standings PDF is the authority — post-race penalties may not be reflected here.',
  };

  const bundle: SeasonBundle = { drivers: model, constructors: constructorsModel };
  cacheSet(`${series}:${season}`, bundle);
  return bundle;
}
