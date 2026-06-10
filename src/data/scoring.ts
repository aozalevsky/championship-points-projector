/**
 * Per-season scoring rules. Used ONLY to project the maximum points available
 * in upcoming events — points already scored always come from official results
 * (which already include fastest-lap bonuses, half points, etc. as awarded).
 */

export interface SeasonScoring {
  /** points for race winner down the order */
  racePoints: number[];
  /** bonus for fastest lap (must finish in points/top 10 in modern era) */
  fastestLapBonus: number;
  /** sprint points, winner first; empty = no sprints that season */
  sprintPoints: number[];
  /** human-readable note shown in the UI */
  note: string;
}

export function scoringFor(season: number): SeasonScoring {
  if (season >= 2025) {
    return {
      racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
      fastestLapBonus: 0,
      sprintPoints: [8, 7, 6, 5, 4, 3, 2, 1],
      note: 'Top 10 score 25–1. Sprints: top 8 score 8–1. No fastest-lap point.',
    };
  }
  if (season >= 2022) {
    return {
      racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
      fastestLapBonus: 1,
      sprintPoints: [8, 7, 6, 5, 4, 3, 2, 1],
      note: 'Top 10 score 25–1, +1 for fastest lap (if in top 10). Sprints: top 8 score 8–1.',
    };
  }
  if (season === 2021) {
    return {
      racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
      fastestLapBonus: 1,
      sprintPoints: [3, 2, 1],
      note: 'Top 10 score 25–1, +1 for fastest lap. Sprints: top 3 score 3–2–1.',
    };
  }
  if (season >= 2019) {
    return {
      racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
      fastestLapBonus: 1,
      sprintPoints: [],
      note: 'Top 10 score 25–1, +1 for fastest lap (if in top 10).',
    };
  }
  if (season >= 2010) {
    return {
      racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
      fastestLapBonus: 0,
      sprintPoints: [],
      note:
        season === 2014
          ? 'Top 10 score 25–1; double points at the season finale (Abu Dhabi).'
          : 'Top 10 score 25–1.',
    };
  }
  if (season >= 2003) {
    return {
      racePoints: [10, 8, 6, 5, 4, 3, 2, 1],
      fastestLapBonus: 0,
      sprintPoints: [],
      note: 'Top 8 score 10–1.',
    };
  }
  if (season >= 1991) {
    return {
      racePoints: [10, 6, 4, 3, 2, 1],
      fastestLapBonus: 0,
      sprintPoints: [],
      note: 'Top 6 score 10–1. All results counted.',
    };
  }
  if (season >= 1961) {
    return {
      racePoints: [9, 6, 4, 3, 2, 1],
      fastestLapBonus: 0,
      sprintPoints: [],
      note: 'Top 6 score 9–1. Note: only the best N results counted toward the title in this era — projections here assume all results count.',
    };
  }
  if (season === 1960) {
    return {
      racePoints: [8, 6, 4, 3, 2, 1],
      fastestLapBonus: 0,
      sprintPoints: [],
      note: 'Top 6 score 8–1. Only the best 6 results counted — projections assume all count.',
    };
  }
  return {
    racePoints: [8, 6, 4, 3, 2],
    fastestLapBonus: 1,
    sprintPoints: [],
    note: 'Top 5 score 8–2, +1 for fastest lap. Shared drives and dropped scores existed — projections are approximate for this era.',
  };
}

/** Max points a driver can take from a single race of the given season/round. */
export function maxRacePoints(season: number, round: number, totalRounds: number): number {
  const s = scoringFor(season);
  let max = s.racePoints[0] + s.fastestLapBonus;
  // 2014: double points at the final round (Abu Dhabi)
  if (season === 2014 && round === totalRounds) max *= 2;
  return max;
}

export function maxSprintPoints(season: number): number {
  const s = scoringFor(season);
  return s.sprintPoints.length > 0 ? s.sprintPoints[0] : 0;
}

/**
 * Constructors' championship maxima. Since 1979 both cars score (a 1–2 finish
 * plus any fastest-lap bonus); from 1958 to 1978 only the best-placed car
 * counted toward the constructors' title.
 */
export function maxConstructorRacePoints(
  season: number,
  round: number,
  totalRounds: number,
): number {
  if (season < 1979) return maxRacePoints(season, round, totalRounds);
  const s = scoringFor(season);
  let max = s.racePoints[0] + (s.racePoints[1] ?? 0) + s.fastestLapBonus;
  if (season === 2014 && round === totalRounds) max *= 2;
  return max;
}

export function maxConstructorSprintPoints(season: number): number {
  const s = scoringFor(season);
  if (s.sprintPoints.length === 0) return 0;
  return season < 1979 ? s.sprintPoints[0] : s.sprintPoints[0] + (s.sprintPoints[1] ?? 0);
}

export function constructorScoringNote(season: number): string {
  if (season < 1958) return 'No constructors’ championship was contested before 1958.';
  if (season < 1979)
    return 'Constructors’ championship: only the best-placed car of each constructor scored. Dropped-scores rules of the era are not reflected per race.';
  const s = scoringFor(season);
  return `Constructors’ championship: both cars score (max ${
    s.racePoints[0] + (s.racePoints[1] ?? 0) + s.fastestLapBonus
  } per race${s.sprintPoints.length ? `, ${s.sprintPoints[0] + (s.sprintPoints[1] ?? 0)} per sprint` : ''}).`;
}
