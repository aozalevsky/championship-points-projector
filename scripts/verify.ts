/**
 * Sanity check: rebuild season totals from per-event results via our model and
 * diff them against the API's official driver standings table.
 * Run: npx tsx scripts/verify.ts [season]
 */
import { fetchSeason } from '../src/data/api';
import { buildSeasonModel, projectSeason } from '../src/data/model';

const season = parseInt(process.argv[2] ?? '2025', 10);

const raw = await fetchSeason(season);
const bundle = buildSeasonModel(season, raw);
const model = bundle.drivers;

console.log(
  `${season}: ${model.segments.length} segments (` +
    `${model.segments.filter((s) => s.type === 'race').length} races, ` +
    `${model.segments.filter((s) => s.type === 'sprint').length} sprints), ` +
    `${model.completedCount} completed, ${model.drivers.length} drivers`,
);

// official standings from the API
const res = await fetch(`https://api.jolpi.ca/ergast/f1/${season}/driverstandings.json?limit=100`);
const json = (await res.json()) as {
  MRData: {
    StandingsTable: {
      StandingsLists: {
        DriverStandings: { position: string; points: string; Driver: { driverId: string } }[];
      }[];
    };
  };
};
const official = json.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? [];

let mismatches = 0;
for (const o of official) {
  const mine = model.drivers.find((d) => d.driver.id === o.Driver.driverId);
  const myPts = mine?.totalPoints ?? 0;
  if (Math.abs(myPts - parseFloat(o.points)) > 1e-9) {
    mismatches++;
    console.log(`  MISMATCH ${o.Driver.driverId}: official=${o.points} computed=${myPts}`);
  }
}
console.log(mismatches === 0 ? 'All driver totals match official standings ✓' : `${mismatches} mismatches ✗`);
if (mismatches > 0) process.exitCode = 1;
if (model.completedCount === 0) {
  console.log('No completed events yet — skipping projection checks.');
  process.exit(process.exitCode ?? 0);
}

// projection sanity at ~75% cutoff
const cutoff = Math.max(1, Math.round(model.completedCount * 0.75));
const proj = projectSeason(model, cutoff);
console.log(`\nProjection after segment ${cutoff} (${model.segments[cutoff - 1].shortName}):`);
for (const p of proj.slice(0, 6)) {
  console.log(
    `  P${p.rankAtCutoff} ${p.driver.code} ${p.pointsAtCutoff} pts → final ${p.minFinal}–${p.maxFinal}, rank P${p.bestFinalRank}–P${p.worstFinalRank}`,
  );
}

// constructors: totals must equal the official standings after reconciliation;
// also report how big the reconciliation delta was (0 for modern seasons)
if (bundle.constructors) {
  let ctorBad = 0;
  for (const o of raw.constructorStandings) {
    const mine = bundle.constructors.drivers.find((d) => d.driver.id === o.constructorId);
    if ((mine?.totalPoints ?? 0) !== o.points) {
      ctorBad++;
      console.log(`  CTOR MISMATCH ${o.constructorId}: official=${o.points} got=${mine?.totalPoints}`);
    }
  }
  console.log(
    ctorBad === 0
      ? `Constructor totals match official standings ✓ (top: ${bundle.constructors.drivers
          .slice(0, 3)
          .map((d) => `${d.driver.lastName} ${d.totalPoints}`)
          .join(', ')})`
      : `${ctorBad} constructor mismatches ✗`,
  );
  if (ctorBad > 0) process.exitCode = 1;
} else {
  console.log('No constructors championship this season (pre-1958)');
}

// invariants
let bad = 0;
const check = (cond: boolean, msg: string) => {
  if (cond) {
    bad++;
    console.log(`  BAD ${msg}`);
  }
};
for (const p of proj) {
  check(p.minFinal > p.maxFinal, `min>max for ${p.driver.code}`);
  check(p.bestFinalRank > p.rankAtCutoff, `best>current for ${p.driver.code}`);
  check(p.worstFinalRank < p.rankAtCutoff, `worst<current for ${p.driver.code}`);
  check(p.bestFinalRank > p.worstFinalRank, `best>worst for ${p.driver.code}`);
}
console.log(bad === 0 ? 'Projection invariants hold ✓' : `${bad} invariant violations ✗`);
if (bad > 0) process.exitCode = 1;
