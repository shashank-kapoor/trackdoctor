import { haversine } from './geo';
import type { ParsedSession, Sample } from './types';

/** Column name aliases, matched case-insensitively against the header (units in brackets stripped). */
const ALIASES = {
  t: ['elapsed_time', 'time', 'elapsed time', 'session time', 'laptime', 'time_s', 'timestamp'],
  lat: ['latitude', 'lat', 'gps latitude', 'gps_latitude'],
  lon: ['longitude', 'lon', 'lng', 'long', 'gps longitude', 'gps_longitude'],
  v: ['speed', 'gps speed', 'gps_speed', 'speed_kmh', 'speed_mph', 'velocity'],
  d: ['distance_traveled', 'distance', 'dist', 'distance traveled'],
  lap: ['lap_number', 'lap', 'lap #', 'lap number'],
  rate: ['device_update_rate'],
} as const;

function splitCsvLine(line: string): string[] {
  if (!line.includes('"')) return line.split(',');
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    else if (c === ',' && !q) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const norm = (s: string) => s.trim().replace(/^"|"$/g, '').toLowerCase();
const stripUnits = (s: string) => s.replace(/\s*[([].*?[)\]]\s*/g, '').trim();

function findCol(header: string[], names: readonly string[]): number {
  for (const n of names) {
    const i = header.findIndex((h) => stripUnits(h) === n);
    if (i >= 0) return i;
  }
  return -1;
}

/** Guess speed unit → multiplier to m/s. */
function speedFactor(headerCell: string, unitCell: string | undefined): number {
  const s = `${headerCell} ${unitCell ?? ''}`.toLowerCase();
  if (s.includes('km/h') || s.includes('kph') || s.includes('kmh')) return 1 / 3.6;
  if (s.includes('mph')) return 0.44704;
  if (s.includes('m/s')) return 1;
  return NaN; // decide from data later
}

export class ParseError extends Error {}

export function parseCsv(text: string): ParsedSession {
  const lines = text.split(/\r?\n/);
  const meta: Record<string, string> = {};
  let hi = -1;
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const cells = splitCsvLine(lines[i]).map(norm);
    const h = cells.map(stripUnits);
    if (h.some((c) => (ALIASES.lat as readonly string[]).includes(c)) && h.some((c) => (ALIASES.lon as readonly string[]).includes(c))) {
      hi = i;
      break;
    }
    if (cells.length >= 2 && cells[0]) meta[cells[0]] = splitCsvLine(lines[i]).slice(1).join(' ').replace(/"/g, '').trim();
  }
  if (hi < 0) throw new ParseError("Couldn't find latitude/longitude columns. Export your session as CSV with GPS position included.");

  const header = splitCsvLine(lines[hi]).map(norm);
  const isRaceChrono = lines[0]?.toLowerCase().includes('racechrono');
  const unitRow = isRaceChrono ? splitCsvLine(lines[hi + 1] ?? '').map(norm) : undefined;

  const col = {
    t: findCol(header, ALIASES.t),
    lat: findCol(header, ALIASES.lat),
    lon: findCol(header, ALIASES.lon),
    v: findCol(header, ALIASES.v),
    d: findCol(header, ALIASES.d),
    lap: findCol(header, ALIASES.lap),
    rate: findCol(header, ALIASES.rate),
  };
  if (col.t < 0) throw new ParseError("Couldn't find a time column.");

  let vf = col.v >= 0 ? speedFactor(header[col.v], unitRow?.[col.v]) : NaN;
  const timeIsUnix = stripUnits(header[col.t]) === 'timestamp';

  const samples: Sample[] = [];
  const rates: number[] = [];
  let distAcc = 0;
  let prev: Sample | null = null;
  for (let i = hi + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const c = line.split(',');
    const lat = parseFloat(c[col.lat]);
    const lon = parseFloat(c[col.lon]);
    let t = parseFloat(c[col.t]);
    if (!isFinite(lat) || !isFinite(lon) || !isFinite(t) || (lat === 0 && lon === 0)) continue;
    if (timeIsUnix && t > 1e11) t /= 1000; // ms epoch
    let d: number;
    if (col.d >= 0 && isFinite(parseFloat(c[col.d]))) d = parseFloat(c[col.d]);
    else {
      if (prev) distAcc += haversine([prev.lat, prev.lon], [lat, lon]);
      d = distAcc;
    }
    const rawV = col.v >= 0 ? parseFloat(c[col.v]) : NaN;
    const lapRaw = col.lap >= 0 ? c[col.lap] : '';
    const lap = lapRaw !== '' && isFinite(parseFloat(lapRaw)) ? parseInt(lapRaw, 10) : null;
    if (col.rate >= 0) {
      const r = parseFloat(c[col.rate]);
      if (isFinite(r) && r > 0) rates.push(r);
    }
    const s: Sample = { t, d, lat, lon, v: rawV, lap };
    samples.push(s);
    prev = s;
  }
  if (samples.length < 100) throw new ParseError('Not enough GPS data in this file.');

  // Normalise time to start at 0
  const t0 = samples[0].t;
  for (const s of samples) s.t -= t0;

  // Speed: unknown unit → compare against position-derived speed. Missing → derive.
  if (col.v < 0 || samples.every((s) => !isFinite(s.v))) {
    deriveSpeed(samples);
  } else {
    if (!isFinite(vf)) vf = guessSpeedFactor(samples);
    for (const s of samples) s.v = isFinite(s.v) ? s.v * vf : 0;
  }

  rates.sort((a, b) => a - b);
  const gpsRateHz = rates.length ? rates[Math.floor(rates.length / 2)] : estimateRate(samples);

  return {
    title: meta['session title'],
    trackName: meta['track name'],
    created: meta['created'],
    source: isRaceChrono ? 'racechrono' : 'generic',
    samples,
    gpsRateHz,
  };
}

function deriveSpeed(samples: Sample[]) {
  for (let i = 0; i < samples.length; i++) {
    const a = samples[Math.max(0, i - 2)];
    const b = samples[Math.min(samples.length - 1, i + 2)];
    const dt = b.t - a.t;
    samples[i].v = dt > 0 ? (b.d - a.d) / dt : 0;
  }
}

function guessSpeedFactor(samples: Sample[]): number {
  // Ratio of logged speed to distance/time over moving stretches.
  let num = 0;
  let den = 0;
  for (let i = 20; i < samples.length; i += 20) {
    const a = samples[i - 20];
    const b = samples[i];
    const dt = b.t - a.t;
    if (dt <= 0) continue;
    const real = (b.d - a.d) / dt;
    if (real < 5) continue;
    num += real;
    den += (a.v + b.v) / 2;
  }
  if (!den) return 1;
  const r = num / den;
  // Snap to the nearest known unit.
  const options = [1, 1 / 3.6, 0.44704];
  return options.reduce((best, o) => (Math.abs(Math.log(o / r)) < Math.abs(Math.log(best / r)) ? o : best), 1);
}

function estimateRate(samples: Sample[]): number | null {
  // Count distinct position changes per second while moving.
  let changes = 0;
  let movingTime = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (b.v < 5) continue;
    movingTime += b.t - a.t;
    if (a.lat !== b.lat || a.lon !== b.lon) changes++;
  }
  return movingTime > 10 ? changes / movingTime : null;
}
