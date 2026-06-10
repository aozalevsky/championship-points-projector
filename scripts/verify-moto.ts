/**
 * Diff our MotoGP adapter's totals against the official standings endpoint.
 * Run: npx tsx scripts/verify-moto.ts [series] [season]
 */
import { loadMotoSeason, type MotoSeriesId } from '../src/data/motogp';

const series = (process.argv[2] ?? 'motogp') as MotoSeriesId;
const season = parseInt(process.argv[3] ?? '2025', 10);

const bundle = await loadMotoSeason(series, season, (m) => process.stdout.write(`\r${m}        `));
const model = bundle.drivers;
console.log(
  `\n${series} ${season}: ${model.segments.length} segments (` +
    `${model.segments.filter((s) => s.type === 'race').length} races, ` +
    `${model.segments.filter((s) => s.type === 'sprint').length} sprints), ` +
    `${model.completedCount} completed, ${model.drivers.length} riders`,
);

const BASE = 'https://api.motogp.pulselive.com/motogp/v1';
const seasons = (await (await fetch(`${BASE}/results/seasons`)).json()) as {
  id: string;
  year: number;
}[];
const seasonId = seasons.find((s) => s.year === season)!.id;
const cats = (await (
  await fetch(`${BASE}/results/categories?seasonUuid=${seasonId}`)
).json()) as { id: string; name: string }[];
const fragment = { motogp: 'motogp', moto2: 'moto2', moto3: 'moto3' }[series];
const cat = cats.find((c) => c.name.toLowerCase().includes(fragment))!;
const standings = (await (
  await fetch(`${BASE}/results/standings?seasonUuid=${seasonId}&categoryUuid=${cat.id}`)
).json()) as { classification: { rider: { full_name: string }; points: number }[] };

let mismatches = 0;
for (const o of standings.classification) {
  const mine = model.drivers.find((d) => d.driver.id === o.rider.full_name);
  const myPts = mine?.totalPoints ?? 0;
  if (myPts !== o.points) {
    mismatches++;
    console.log(`  MISMATCH ${o.rider.full_name}: official=${o.points} computed=${myPts}`);
  }
}
console.log(
  mismatches === 0 ? 'All rider totals match official standings ✓' : `${mismatches} mismatches ✗`,
);
if (mismatches > 0) process.exitCode = 1;

if (bundle.constructors) {
  console.log(
    'Constructors (computed, best-bike rule): ' +
      bundle.constructors.drivers
        .slice(0, 5)
        .map((d) => `${d.driver.lastName} ${d.totalPoints}`)
        .join(', '),
  );
}

// per-segment dump for the leader, to spot duplicates
const leader = model.drivers[0];
if (!leader) {
  console.log('No completed events yet — skipping leader dump.');
  process.exit(process.exitCode ?? 0);
}
console.log(`\nLeader ${leader.driver.id} per segment:`);
model.segments.slice(0, model.completedCount).forEach((s, i) => {
  const pts = leader.pointsBySegment[i];
  if (pts > 0) console.log(`  ${String(pts).padStart(3)}  ${s.shortName.padEnd(7)} ${s.raceName}`);
});
