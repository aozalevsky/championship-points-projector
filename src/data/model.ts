import type { ApiRace, RawSeasonData } from './api';
import {
  constructorScoringNote,
  maxConstructorRacePoints,
  maxConstructorSprintPoints,
  maxRacePoints,
  maxSprintPoints,
  scoringFor,
} from './scoring';
import type {
  DriverInfo,
  DriverProjection,
  DriverSeason,
  SeasonBundle,
  SeasonModel,
  Segment,
  SegmentResult,
  TeamInfo,
} from '../types';

const COUNTRY_CODES: Record<string, string> = {
  Australia: 'AUS', China: 'CHN', Japan: 'JPN', Bahrain: 'BHR', 'Saudi Arabia': 'SAU',
  USA: 'USA', 'United States': 'USA', Italy: 'ITA', Monaco: 'MON', Spain: 'ESP',
  Canada: 'CAN', Austria: 'AUT', UK: 'GBR', 'United Kingdom': 'GBR', Belgium: 'BEL',
  Hungary: 'HUN', Netherlands: 'NED', Azerbaijan: 'AZE', Singapore: 'SGP', Mexico: 'MEX',
  Brazil: 'BRA', Qatar: 'QAT', UAE: 'ABU', 'United Arab Emirates': 'ABU', France: 'FRA',
  Germany: 'GER', Russia: 'RUS', Turkey: 'TUR', Portugal: 'POR', Malaysia: 'MAL',
  Korea: 'KOR', India: 'IND', Argentina: 'ARG', 'South Africa': 'RSA', Sweden: 'SWE',
  Switzerland: 'SUI', Morocco: 'MAR', Vietnam: 'VIE',
};

const COUNTRY_ISO: Record<string, string> = {
  Australia: 'AU', China: 'CN', Japan: 'JP', Bahrain: 'BH', 'Saudi Arabia': 'SA',
  USA: 'US', 'United States': 'US', Italy: 'IT', Monaco: 'MC', Spain: 'ES',
  Canada: 'CA', Austria: 'AT', UK: 'GB', 'United Kingdom': 'GB', Belgium: 'BE',
  Hungary: 'HU', Netherlands: 'NL', Azerbaijan: 'AZ', Singapore: 'SG', Mexico: 'MX',
  Brazil: 'BR', Qatar: 'QA', UAE: 'AE', 'United Arab Emirates': 'AE', France: 'FR',
  Germany: 'DE', Russia: 'RU', Turkey: 'TR', Portugal: 'PT', Malaysia: 'MY',
  Korea: 'KR', India: 'IN', Argentina: 'AR', 'South Africa': 'ZA', Sweden: 'SE',
  Switzerland: 'CH', Morocco: 'MA', Vietnam: 'VN',
};

/** ISO 3166-1 alpha-2 code → emoji flag (regional indicator pair). */
export function flagFromIso(iso: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso)) return '';
  return String.fromCodePoint(
    ...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/** Country name → emoji flag; '' if unknown. */
export function countryFlag(country: string): string {
  const iso = COUNTRY_ISO[country];
  return iso ? flagFromIso(iso) : '';
}

function shortName(race: ApiRace): string {
  const country = race.Circuit.Location.country;
  const code = COUNTRY_CODES[country] ?? country.slice(0, 3).toUpperCase();
  // distinguish multiple events in one country (e.g. Miami / Austin / Las Vegas)
  if (country === 'USA' || country === 'United States') {
    if (race.raceName.includes('Miami')) return 'MIA';
    if (race.raceName.includes('Las Vegas')) return 'LVG';
  }
  if (country === 'Italy' && race.raceName.includes('Emilia')) return 'EMI';
  return code;
}

/** 3-letter code for a constructor name: "McLaren" → MCL, "Red Bull" → RB. */
export function entityCode(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

/** Wrap per-entity points into the same shape the chart uses for drivers. */
export function makeStandaloneEntity(
  id: string,
  name: string,
  pointsBySegment: number[],
): DriverSeason {
  // slugged name as team id so brand colors resolve ("Red Bull" → red_bull)
  const team: TeamInfo = {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    name,
  };
  return {
    driver: { id, code: entityCode(name), firstName: '', lastName: name },
    pointsBySegment,
    teamBySegment: pointsBySegment.map(() => team),
    team,
    totalPoints: pointsBySegment.reduce((a, b) => a + b, 0),
  };
}

export function buildSeasonModel(season: number, raw: RawSeasonData): SeasonBundle {
  const totalRounds = raw.schedule.length;
  const resultsByRound = new Map(raw.raceResults.map((r) => [parseInt(r.round, 10), r]));
  const sprintsByRound = new Map(raw.sprintResults.map((r) => [parseInt(r.round, 10), r]));

  // ---- timeline of scoring segments, chronological ----
  const segments: Segment[] = [];
  for (const race of [...raw.schedule].sort((a, b) => +a.round - +b.round)) {
    const round = parseInt(race.round, 10);
    const base = {
      round,
      raceName: race.raceName,
      country: race.Circuit.Location.country,
      locality: race.Circuit.Location.locality,
      circuit: race.Circuit.circuitName,
      flag: countryFlag(race.Circuit.Location.country),
    };
    const hasSprint = !!race.Sprint || sprintsByRound.has(round);
    if (hasSprint) {
      segments.push({
        ...base,
        key: `${round}-sprint`,
        type: 'sprint',
        shortName: `${shortName(race)} S`,
        date: race.Sprint?.date ?? race.date,
        maxPoints: maxSprintPoints(season),
        completed: (sprintsByRound.get(round)?.SprintResults?.length ?? 0) > 0,
      });
    }
    segments.push({
      ...base,
      key: `${round}-race`,
      type: 'race',
      shortName: shortName(race),
      date: race.date,
      maxPoints: maxRacePoints(season, round, totalRounds),
      completed: (resultsByRound.get(round)?.Results?.length ?? 0) > 0,
    });
  }

  // completed prefix: everything before the first un-scored segment
  let completedCount = 0;
  while (completedCount < segments.length && segments[completedCount].completed) completedCount++;

  // ---- per-driver points per segment ----
  const driverInfo = new Map<string, DriverInfo>();
  const teamInfo = new Map<string, TeamInfo>();
  const points = new Map<string, number[]>(); // driverId -> per completed segment
  const teams = new Map<string, (TeamInfo | null)[]>();
  const resultsBySegment: SegmentResult[][] = [];

  segments.slice(0, completedCount).forEach((seg, segIdx) => {
    const race = seg.type === 'sprint' ? sprintsByRound.get(seg.round) : resultsByRound.get(seg.round);
    const rows = (seg.type === 'sprint' ? race?.SprintResults : race?.Results) ?? [];
    resultsBySegment.push(
      rows.map((row) => ({
        driverId: row.Driver.driverId,
        position: Number.isFinite(parseInt(row.position, 10)) ? parseInt(row.position, 10) : null,
        points: parseFloat(row.points),
        status: row.status && row.status !== 'Finished' ? row.status : undefined,
      })),
    );
    for (const row of rows) {
      const d = row.Driver;
      if (!driverInfo.has(d.driverId)) {
        driverInfo.set(d.driverId, {
          id: d.driverId,
          code: d.code ?? d.familyName.slice(0, 3).toUpperCase(),
          firstName: d.givenName,
          lastName: d.familyName,
          number: d.permanentNumber,
        });
        points.set(d.driverId, new Array(completedCount).fill(0));
        teams.set(d.driverId, new Array(completedCount).fill(null));
      }
      const c = row.Constructor;
      if (!teamInfo.has(c.constructorId)) {
        teamInfo.set(c.constructorId, { id: c.constructorId, name: c.name });
      }
      points.get(d.driverId)![segIdx] += parseFloat(row.points);
      teams.get(d.driverId)![segIdx] = teamInfo.get(c.constructorId)!;
    }
  });

  const drivers: DriverSeason[] = [...driverInfo.values()].map((driver) => {
    const pointsBySegment = points.get(driver.id)!;
    const teamBySegment = teams.get(driver.id)!;
    const lastTeam = [...teamBySegment].reverse().find((t) => t !== null);
    return {
      driver,
      pointsBySegment,
      teamBySegment,
      team: lastTeam ?? { id: 'unknown', name: 'Unknown' },
      totalPoints: pointsBySegment.reduce((a, b) => a + b, 0),
    };
  });
  drivers.sort((a, b) => b.totalPoints - a.totalPoints);

  const driversModel: SeasonModel = {
    season,
    segments,
    completedCount,
    drivers,
    teams: [...teamInfo.values()],
    scoringNote: scoringFor(season).note,
    resultsBySegment,
  };

  // ---- constructors' championship (contested since 1958) ----
  // Until 1978 only the best-placed car of each constructor scored; from 1979
  // both cars count. Reconcile against the official standings to absorb the
  // dropped-scores rules of older eras.
  if (season < 1958) return { drivers: driversModel, constructors: null };

  const bothCarsCount = season >= 1979;
  const ctorNames = new Map<string, string>();
  const ctorPoints = new Map<string, number[]>();

  segments.slice(0, completedCount).forEach((seg, segIdx) => {
    const race =
      seg.type === 'sprint' ? sprintsByRound.get(seg.round) : resultsByRound.get(seg.round);
    const rows = (seg.type === 'sprint' ? race?.SprintResults : race?.Results) ?? [];
    for (const row of rows) {
      const c = row.Constructor;
      if (!ctorNames.has(c.constructorId)) {
        ctorNames.set(c.constructorId, c.name);
        ctorPoints.set(c.constructorId, new Array(completedCount).fill(0));
      }
      const arr = ctorPoints.get(c.constructorId)!;
      const pts = parseFloat(row.points);
      arr[segIdx] = bothCarsCount ? arr[segIdx] + pts : Math.max(arr[segIdx], pts);
    }
  });

  const official = new Map(raw.constructorStandings.map((s) => [s.constructorId, s]));
  for (const { constructorId, name } of raw.constructorStandings) {
    if (!ctorNames.has(constructorId)) {
      ctorNames.set(constructorId, name);
      ctorPoints.set(constructorId, new Array(completedCount).fill(0));
    }
  }

  const ctorEntries = [...ctorNames].map(([id, name]) =>
    makeStandaloneEntity(id, name, ctorPoints.get(id)!),
  );
  if (completedCount > 0 && official.size > 0) {
    for (const e of ctorEntries) {
      const target = official.get(e.driver.id)?.points;
      if (target !== undefined && target !== e.totalPoints) {
        e.pointsBySegment[completedCount - 1] += target - e.totalPoints;
        e.totalPoints = target;
      }
    }
  }
  ctorEntries.sort((a, b) => b.totalPoints - a.totalPoints);

  const ctorSegments = segments.map((s) => ({
    ...s,
    maxPoints:
      s.type === 'sprint'
        ? maxConstructorSprintPoints(season)
        : maxConstructorRacePoints(season, s.round, segments.filter((x) => x.type === 'race').length),
  }));

  const constructorsModel: SeasonModel = {
    season,
    segments: ctorSegments,
    completedCount,
    drivers: ctorEntries,
    teams: ctorEntries.map((e) => e.team),
    scoringNote: constructorScoringNote(season),
  };

  return { drivers: driversModel, constructors: constructorsModel };
}

/**
 * Project every driver from a cutoff (number of segments considered "raced").
 * Min final = score zero in everything remaining; max = win everything remaining.
 */
export function projectSeason(model: SeasonModel, cutoff: number): DriverProjection[] {
  const { segments } = model;
  const future = segments.slice(cutoff);

  const maxCumTemplate: number[] = [];
  let acc = 0;
  for (const seg of future) {
    acc += seg.maxPoints;
    maxCumTemplate.push(acc);
  }

  const projections = model.drivers.map((d) => {
    const actualCumulative: number[] = [];
    let sum = 0;
    for (let i = 0; i < cutoff; i++) {
      sum += d.pointsBySegment[i] ?? 0;
      actualCumulative.push(sum);
    }
    // team as of the cutoff (handles mid-season swaps)
    const teamAtCutoff =
      [...d.teamBySegment.slice(0, cutoff)].reverse().find((t) => t !== null) ?? d.team;
    return {
      driver: d.driver,
      team: teamAtCutoff,
      actualCumulative,
      pointsAtCutoff: sum,
      maxCumulative: maxCumTemplate.map((m) => sum + m),
      minFinal: sum,
      maxFinal: sum + acc,
      rankAtCutoff: 0,
      bestFinalRank: 0,
      worstFinalRank: 0,
    };
  });

  projections.sort((a, b) => b.pointsAtCutoff - a.pointsAtCutoff);
  projections.forEach((p, i) => {
    p.rankAtCutoff = i + 1;
    // guaranteed ahead: drivers whose worst case still beats my best case
    p.bestFinalRank = 1 + projections.filter((o) => o !== p && o.minFinal > p.maxFinal).length;
    // could finish ahead: drivers whose best case reaches my worst case (ties can go either way)
    p.worstFinalRank = 1 + projections.filter((o) => o !== p && o.maxFinal >= p.minFinal).length;
  });
  return projections;
}
