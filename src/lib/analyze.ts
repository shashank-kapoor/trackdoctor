import { haversine } from './geo';
import { buildLaps } from './laps';
import { parseCsv, ParseError } from './parse';

export { ParseError };
import type { CornerAnalysis, CornerLap, LapTrace, ParsedSession, SessionAnalysis, TrackDef } from './types';

export const STEP = 2;
const APEX_WINDOW = 70; // m either side of the corner anchor to look for the slowest point
const ENTRY_WINDOW = 450; // m before the slowest point to look for the approach peak
const EXIT_OFFSET = 100; // m after the slowest point for the exit-speed measurement

/** Middle value; with an even count, the mean of the two middle values. */
export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function argMin(v: Float64Array, a: number, b: number) {
  let bi = a;
  for (let i = a; i <= b; i++) if (v[i] < v[bi]) bi = i;
  return bi;
}
function argMax(v: Float64Array, a: number, b: number) {
  let bi = a;
  for (let i = a; i <= b; i++) if (v[i] > v[bi]) bi = i;
  return bi;
}

/** Count separate slow-downs (local minima with ≥3 km/h recovery between them). */
function countDips(v: Float64Array, a: number, b: number): number {
  const r = 6;
  const cands: number[] = [];
  for (let i = a; i <= b; i++) {
    let isMin = true;
    for (let k = Math.max(a, i - r); k <= Math.min(b, i + r); k++) if (v[k] < v[i]) isMin = false;
    if (isMin && (cands.length === 0 || i - cands[cands.length - 1] > r)) cands.push(i);
  }
  const kept: number[] = [];
  for (const c of cands) {
    const last = kept[kept.length - 1];
    if (last === undefined) {
      kept.push(c);
      continue;
    }
    let peak = 0;
    for (let k = last; k <= c; k++) peak = Math.max(peak, v[k]);
    if (peak - Math.max(v[last], v[c]) >= 3) kept.push(c);
    else if (v[c] < v[last]) kept[kept.length - 1] = c;
  }
  return Math.max(1, kept.length);
}

function nearestIndex(lap: LapTrace, p: [number, number]): number {
  let bi = 0;
  let bd = Infinity;
  for (let i = 0; i < lap.lat.length; i++) {
    const d = haversine([lap.lat[i], lap.lon[i]], p);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  return bi;
}

function measure(
  lap: LapTrace,
  sec: [number, number],
  anchor: number,
  prevAnchor: number,
): Omit<CornerLap, 'loss'> {
  const w = APEX_WINDOW / STEP;
  const n = lap.v.length;
  const minAt = argMin(lap.v, Math.max(sec[0], anchor - w), Math.min(sec[1], anchor + w));
  const minSpeed = lap.v[minAt];
  const entryFrom = Math.max(0, prevAnchor, minAt - ENTRY_WINDOW / STEP);
  const entryAt = argMax(lap.v, entryFrom, minAt);
  const entrySpeed = lap.v[entryAt];
  let brakeAt = entryAt;
  for (let i = entryAt; i < minAt; i++)
    if (lap.v[i] < entrySpeed - 3) {
      brakeAt = Math.max(entryAt, i - 1);
      break;
    }
  let throttleAt = minAt;
  for (let i = minAt; i < n; i++)
    if (lap.v[i] > minSpeed + 2) {
      throttleAt = i;
      break;
    }
  const exitSpeed = lap.v[Math.min(n - 1, minAt + EXIT_OFFSET / STEP)];
  let peak = 0;
  const win = 10; // 20 m
  for (let i = brakeAt; i + win <= minAt; i++) {
    const v1 = lap.v[i] / 3.6;
    const v2 = lap.v[i + win] / 3.6;
    peak = Math.max(peak, (v1 * v1 - v2 * v2) / (2 * win * STEP) / 9.81);
  }
  return {
    lap: lap.lap,
    sectionTime: lap.t[sec[1]] - lap.t[sec[0]],
    minSpeed,
    minAt: minAt * STEP,
    entrySpeed,
    brakeAt: brakeAt * STEP,
    exitSpeed,
    throttleAt: throttleAt * STEP,
    dips: countDips(lap.v, Math.max(sec[0], brakeAt, minAt - 60 / STEP), Math.min(sec[1], minAt + 60 / STEP)),
    peakDecelG: peak,
  };
}

export interface AnalyzeOptions {
  /** Laps the driver chose to leave out (traffic, spins…). */
  exclude?: number[];
  /** Laps the driver chose to bring back in even though we flagged them. */
  include?: number[];
  dateMs?: number;
}

export function analyze(csvText: string, track: TrackDef, opts: AnalyzeOptions = {}): SessionAnalysis {
  return analyzeParsed(parseCsv(csvText), track, opts);
}

export function analyzeParsed(parsed: ParsedSession, track: TrackDef, opts: AnalyzeOptions = {}): SessionAnalysis {
  const exclude = opts.exclude ?? [];
  const include = opts.include ?? [];
  const mid = parsed.samples[Math.floor(parsed.samples.length / 2)];
  if (haversine([mid.lat, mid.lon], track.center) > 4000)
    throw new ParseError(`This session doesn't look like it was recorded at ${track.name}. Pick the matching track and try again.`);
  const laps = buildLaps(parsed, track, STEP);
  if (!laps.length)
    throw new ParseError(
      `No complete laps of ${track.name} found. Check you picked the right track and that the file contains at least one full lap.`,
    );
  const valid = laps.filter((l) => (l.kind === 'flying' || include.includes(l.lap)) && !exclude.includes(l.lap));
  const pool = valid.length ? valid : laps;
  const best = pool.reduce((a, b) => (b.time < a.time ? b : a));
  const gridLen = best.v.length;
  const w = APEX_WINDOW / STEP;

  // Locate each corner on the best lap, then refine to where drivers actually hit the slowest point.
  const anchors = track.corners.map((c) => {
    const near = nearestIndex(best, c.apex);
    const mins = pool.map((l) => argMin(l.v, Math.max(0, near - w), Math.min(gridLen - 1, near + w)));
    return [...mins].sort((a, b) => a - b)[Math.floor(mins.length / 2)];
  });
  const bounds = anchors.map((a, i) => {
    const lo = i === 0 ? 0 : Math.round((anchors[i - 1] + a) / 2);
    const hi = i === anchors.length - 1 ? gridLen - 1 : Math.round((a + anchors[i + 1]) / 2);
    return [lo, hi] as [number, number];
  });

  const corners: CornerAnalysis[] = track.corners.map((def, i) => {
    const prevAnchor = i === 0 ? 0 : anchors[i - 1];
    const raw = pool.map((l) => measure(l, bounds[i], anchors[i], prevAnchor));
    const bestSec = Math.min(...raw.map((r) => r.sectionTime));
    const lapsM: CornerLap[] = raw.map((r) => ({ ...r, loss: r.sectionTime - bestSec }));
    const bestLapM = lapsM.find((r) => r.sectionTime === bestSec)!;
    const mins = lapsM.map((r) => r.minSpeed);
    return {
      def,
      apexS: anchors[i] * STEP,
      sectionStart: bounds[i][0] * STEP,
      sectionEnd: bounds[i][1] * STEP,
      laps: lapsM,
      best: bestLapM,
      meanLoss: lapsM.reduce((s, r) => s + r.loss, 0) / lapsM.length,
      medianLoss: median(lapsM.map((r) => r.loss)),
      maxLoss: Math.max(...lapsM.map((r) => r.loss)),
      minSpeedSpread: Math.max(...mins) - Math.min(...mins),
    };
  });

  return {
    track,
    parsed,
    step: STEP,
    gridLen,
    laps,
    validLaps: pool.map((l) => l.lap),
    excluded: exclude,
    bestLap: best.lap,
    idealTime: corners.reduce((s, c) => s + c.best.sectionTime, 0),
    corners,
    dateMs: opts.dateMs ?? sessionDate(parsed.created, Date.now()),
  };
}

/** Parse RaceChrono's "Created,13/12/2025,01:24" (UTC) style, falling back to now. */
export function sessionDate(created: string | undefined, fallback: number): number {
  if (!created) return fallback;
  const m = created.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2}):(\d{2})/);
  if (!m) return fallback;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
}
