/**
 * Jolpica-F1 API client (community successor of the Ergast API).
 * Mirrors official formula1.com results, including points exactly as awarded
 * (fastest-lap bonuses, half points for shortened races, etc.).
 */

const BASE = 'https://api.jolpi.ca/ergast/f1';
const PAGE_SIZE = 100;
const CACHE_PREFIX = 'f1u:v1:';

// ---- raw API shapes (subset) ----

interface ApiDriver {
  driverId: string;
  code?: string;
  permanentNumber?: string;
  givenName: string;
  familyName: string;
}

interface ApiConstructor {
  constructorId: string;
  name: string;
}

interface ApiResultRow {
  position: string;
  points: string;
  status?: string;
  Driver: ApiDriver;
  Constructor: ApiConstructor;
}

export interface ApiRace {
  round: string;
  raceName: string;
  date: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location: { country: string; locality: string };
  };
  Sprint?: { date: string };
  Results?: ApiResultRow[];
  SprintResults?: ApiResultRow[];
}

interface MRData {
  total: string;
  RaceTable?: { Races: ApiRace[] };
  StandingsTable?: {
    StandingsLists: {
      ConstructorStandings?: {
        points: string;
        Constructor: ApiConstructor;
      }[];
    }[];
  };
}

// ---- caching ----

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
    // storage full — drop our own cache and continue without caching
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url: string): Promise<MRData> {
  for (let attempt = 0; ; attempt++) {
    // bypass the browser HTTP cache: Jolpica sends max-age=3600, which would
    // otherwise defeat the ⟳ Refresh button — localStorage is our only cache
    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === 429 && attempt < 3) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`API request failed (${res.status}) for ${url}`);
    const json = (await res.json()) as { MRData: MRData };
    return json.MRData;
  }
}

/** Fetch all pages of a paginated endpoint and merge the Races arrays. */
async function fetchAllRaces(path: string, cacheKey: string, maxAgeMs: number): Promise<ApiRace[]> {
  const cached = cacheGet(cacheKey, maxAgeMs);
  if (cached) return cached as ApiRace[];

  const merged = new Map<string, ApiRace>();
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const data = await fetchJson(`${BASE}/${path}?limit=${PAGE_SIZE}&offset=${offset}`);
    total = parseInt(data.total, 10);
    for (const race of data.RaceTable?.Races ?? []) {
      const existing = merged.get(race.round);
      if (existing) {
        // result rows are split across pages — concatenate
        if (race.Results) existing.Results = [...(existing.Results ?? []), ...race.Results];
        if (race.SprintResults)
          existing.SprintResults = [...(existing.SprintResults ?? []), ...race.SprintResults];
      } else {
        merged.set(race.round, { ...race });
      }
    }
    offset += PAGE_SIZE;
    if (offset < total) await sleep(300); // stay under the API rate limit
  }
  const races = [...merged.values()];
  cacheSet(cacheKey, races);
  return races;
}

export interface RawSeasonData {
  schedule: ApiRace[];
  raceResults: ApiRace[];
  sprintResults: ApiRace[];
  /** official constructors' totals (empty before 1958) */
  constructorStandings: { constructorId: string; name: string; points: number }[];
}

async function fetchConstructorStandings(
  season: number,
  maxAgeMs: number,
): Promise<RawSeasonData['constructorStandings']> {
  const cacheKey = `${season}:ctorstandings`;
  const cached = cacheGet(cacheKey, maxAgeMs);
  if (cached) return cached as RawSeasonData['constructorStandings'];
  const data = await fetchJson(`${BASE}/${season}/constructorstandings.json?limit=100`);
  const rows = data.StandingsTable?.StandingsLists[0]?.ConstructorStandings ?? [];
  const standings = rows.map((r) => ({
    constructorId: r.Constructor.constructorId,
    name: r.Constructor.name,
    points: parseFloat(r.points),
  }));
  cacheSet(cacheKey, standings);
  return standings;
}

export async function fetchSeason(season: number): Promise<RawSeasonData> {
  const now = new Date();
  // a season is safely over once the following year has started
  const finished = season < now.getFullYear();
  const maxAge = finished ? Infinity : 60 * 60 * 1000; // 1 hour for the live season

  const schedule = await fetchAllRaces(`${season}.json`, `${season}:schedule`, maxAge);
  const raceResults = await fetchAllRaces(`${season}/results.json`, `${season}:results`, maxAge);
  const sprintResults = await fetchAllRaces(`${season}/sprint.json`, `${season}:sprint`, maxAge);
  const constructorStandings = await fetchConstructorStandings(season, maxAge);
  return { schedule, raceResults, sprintResults, constructorStandings };
}

export function clearSeasonCache(season: number): void {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(`${CACHE_PREFIX}${season}:`)) localStorage.removeItem(k);
  }
}
