export interface DriverInfo {
  id: string;
  code: string; // 3-letter code, e.g. VER
  firstName: string;
  lastName: string;
  number?: string;
}

export interface TeamInfo {
  id: string;
  name: string;
}

export type SegmentType = 'race' | 'sprint';

export interface Segment {
  key: string; // e.g. "5-sprint", "5-race"
  round: number;
  type: SegmentType;
  raceName: string;
  shortName: string; // e.g. "MIA", "MIA S"
  country: string;
  locality: string;
  circuit: string;
  /** emoji flag, '' if unknown */
  flag: string;
  date: string;
  maxPoints: number; // max points a driver can score in this segment
  completed: boolean; // results exist
}

export interface DriverSeason {
  driver: DriverInfo;
  /** team in each completed segment (null if did not participate) */
  teamBySegment: (TeamInfo | null)[];
  /** points scored in each completed segment (0 if did not participate) */
  pointsBySegment: number[];
  /** most recent team */
  team: TeamInfo;
  totalPoints: number;
}

export interface SegmentResult {
  driverId: string;
  position: number | null;
  points: number;
  /** DNF reason / classification note, when noteworthy */
  status?: string;
}

export interface SeasonModel {
  season: number;
  segments: Segment[];
  completedCount: number; // number of segments with results
  drivers: DriverSeason[];
  teams: TeamInfo[];
  /** human-readable description of the season's scoring scheme */
  scoringNote: string;
  /** full classification per completed segment (drivers models only) */
  resultsBySegment?: SegmentResult[][];
}

export interface SeasonBundle {
  drivers: SeasonModel;
  /** null when the constructors' championship was not contested that season */
  constructors: SeasonModel | null;
}

export interface DriverProjection {
  driver: DriverInfo;
  team: TeamInfo;
  /** cumulative actual points after each segment 0..cutoff-1 */
  actualCumulative: number[];
  pointsAtCutoff: number;
  /** cumulative max points for segments cutoff..end (length = segments.length - cutoff) */
  maxCumulative: number[];
  minFinal: number;
  maxFinal: number;
  rankAtCutoff: number;
  bestFinalRank: number;
  worstFinalRank: number;
}
