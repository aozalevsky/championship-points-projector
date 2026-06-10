import { clearSeasonCache, fetchSeason } from './api';
import { buildSeasonModel } from './model';
import { clearMotoCache, loadMotoSeason, MOTO_SERIES, type MotoSeriesId } from './motogp';
import type { SeasonBundle } from '../types';

export type SeriesId = 'f1' | MotoSeriesId;

export interface SeriesDef {
  id: SeriesId;
  label: string;
  firstSeason: number;
  /** data source credit, shown in the footer and error fallback */
  sourceName: string;
  sourceUrl: string;
  /** extra hint shown when data can't be loaded */
  fallbackHint: string;
  /** word for the points-scoring humans: Driver / Rider */
  entityWord: string;
  loadSeason: (season: number, onProgress?: (message: string) => void) => Promise<SeasonBundle>;
  clearCache: (season: number) => void;
}

export const SERIES: SeriesDef[] = [
  {
    id: 'f1',
    label: 'Formula 1',
    firstSeason: 1950,
    entityWord: 'Driver',
    sourceName: 'Jolpica-F1 API (Ergast successor, mirrors official formula1.com results)',
    sourceUrl: 'https://github.com/jolpica/jolpica-f1',
    fallbackHint:
      'The Jolpica API may be down or rate-limiting. Wait a minute and retry; cached seasons keep working offline.',
    loadSeason: async (season, onProgress) => {
      onProgress?.('Fetching results from the Jolpica API…');
      return buildSeasonModel(season, await fetchSeason(season));
    },
    clearCache: clearSeasonCache,
  },
  ...(Object.keys(MOTO_SERIES) as MotoSeriesId[]).map(
    (id): SeriesDef => ({
      id,
      label: { motogp: 'MotoGP', moto2: 'Moto2', moto3: 'Moto3' }[id],
      firstSeason: MOTO_SERIES[id].firstSeason,
      entityWord: 'Rider',
      sourceName: 'unofficial motogp.com API (© Dorna Sports, not affiliated)',
      sourceUrl: 'https://github.com/robschmitt/MotoGP-API',
      fallbackHint:
        'The motogp.com API blocks direct browser requests, so the app relies on the local dev/preview server proxy. Make sure you are running via "npm run dev" or "npm run preview", or the API itself may be unavailable right now.',
      loadSeason: (season, onProgress) => loadMotoSeason(id, season, onProgress),
      clearCache: (season) => clearMotoCache(id, season),
    }),
  ),
];

export function seriesById(id: SeriesId): SeriesDef {
  return SERIES.find((s) => s.id === id) ?? SERIES[0];
}
