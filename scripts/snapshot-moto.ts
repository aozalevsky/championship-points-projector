/**
 * Build MotoGP/Moto2/Moto3 season snapshots (SeasonBundle JSON) for the
 * browser to fall back on when the /api/motogp proxy is blocked.
 *
 * Run: npx tsx scripts/snapshot-moto.ts <outDir> [--budget-min N]
 *
 * Writes <outDir>/<series>/<season>.json and <outDir>/index.json. The current
 * and previous season are always rebuilt; older seasons are only built when
 * their file is missing, newest first, until the time budget runs out — so a
 * full backfill spreads over several scheduled runs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildMotoSeason, MOTO_SERIES, type MotoSeriesId } from '../src/data/motogp';

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--'));
if (!outDir) {
  console.error('usage: snapshot-moto.ts <outDir> [--budget-min N]');
  process.exit(2);
}
const budgetIdx = args.indexOf('--budget-min');
const budgetMs = (budgetIdx >= 0 ? Number(args[budgetIdx + 1]) : 30) * 60_000;
const deadline = Date.now() + budgetMs;

const currentYear = new Date().getUTCFullYear();
const seriesIds = Object.keys(MOTO_SERIES) as MotoSeriesId[];

interface IndexFile {
  generatedAt: string;
  seasons: Record<string, number[]>;
  errors: string[];
}

const errors: string[] = [];
let failedRecent = false;

async function snapshot(series: MotoSeriesId, season: number): Promise<void> {
  const file = join(outDir!, series, `${season}.json`);
  try {
    const bundle = await buildMotoSeason(series, season);
    mkdirSync(join(outDir!, series), { recursive: true });
    writeFileSync(file, JSON.stringify(bundle));
    console.log(`ok   ${series} ${season}`);
  } catch (e) {
    const msg = `${series} ${season}: ${(e as Error).message}`;
    console.log(`FAIL ${msg}`);
    errors.push(msg);
    // early in the year the new season may not exist in the API yet
    const notPublished = /not found in the motogp API|no events found/.test(msg);
    if (season >= currentYear - 1 && !notPublished) failedRecent = true;
  }
}

// 1) always refresh the live and previous season (penalties can land late)
for (const series of seriesIds) {
  for (const season of [currentYear, currentYear - 1]) {
    await snapshot(series, season);
  }
}

// 2) backfill missing older seasons, newest first, interleaving series
const oldest = Math.min(...seriesIds.map((s) => MOTO_SERIES[s].firstSeason));
backfill: for (let season = currentYear - 2; season >= oldest; season--) {
  for (const series of seriesIds) {
    if (season < MOTO_SERIES[series].firstSeason) continue;
    if (existsSync(join(outDir, series, `${season}.json`))) continue;
    if (Date.now() > deadline) {
      console.log('time budget used up — remaining seasons next run');
      break backfill;
    }
    await snapshot(series, season);
  }
}

// 3) index: what exists + when it was refreshed (used by the health check)
const seasons: Record<string, number[]> = {};
for (const series of seriesIds) {
  seasons[series] = [];
  for (let y = MOTO_SERIES[series].firstSeason; y <= currentYear; y++) {
    if (existsSync(join(outDir, series, `${y}.json`))) seasons[series].push(y);
  }
}
const indexPath = join(outDir, 'index.json');
const previous: Partial<IndexFile> = existsSync(indexPath)
  ? JSON.parse(readFileSync(indexPath, 'utf8'))
  : {};
const index: IndexFile = {
  // keep the old timestamp when the recent seasons could not be refreshed,
  // so the health check notices a stale snapshot
  generatedAt: failedRecent && previous.generatedAt ? previous.generatedAt : new Date().toISOString(),
  seasons,
  errors,
};
writeFileSync(indexPath, JSON.stringify(index, null, 1) + '\n');

if (failedRecent) {
  console.error('could not refresh the current/previous season');
  process.exitCode = 1;
}
