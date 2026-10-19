import { segmentCross } from './geo';
import type { LapKind, LapTrace, ParsedSession, Sample, TrackDef } from './types';

interface RawLap {
  lap: number;
  start: number; // sample index
  end: number; // sample index (exclusive-ish: first sample of next lap)
  tStart: number;
  tEnd: number;
  complete: boolean;
}

/** Split samples into laps, using the logger's lap numbers if present, otherwise start/finish crossings. */
export function splitLaps(p: ParsedSession, track: TrackDef): RawLap[] {
  const s = p.samples;
  const hasLapCol = s.some((x) => x.lap !== null);
  const starts: { idx: number; t: number }[] = [];
  if (hasLapCol) {
    let prev: number | null = null;
    for (let i = 0; i < s.length; i++) {
      const l = s[i].lap;
      if (l !== null && l !== prev) {
        starts.push({ idx: i, t: s[i].t });
        prev = l;
      }
    }
  } else {
    const [a, b] = track.startLine;
    let lastT = -Infinity;
    for (let i = 1; i < s.length; i++) {
      const f = segmentCross([s[i - 1].lat, s[i - 1].lon], [s[i].lat, s[i].lon], a, b);
      if (f === null || s[i].v < 8) continue;
      const t = s[i - 1].t + f * (s[i].t - s[i - 1].t);
      if (t - lastT < 20) continue; // debounce
      starts.push({ idx: i, t });
      lastT = t;
    }
  }
  const laps: RawLap[] = [];
  for (let k = 0; k < starts.length; k++) {
    const next = starts[k + 1];
    const end = next ? next.idx : s.length - 1;
    laps.push({
      lap: k + 1,
      start: starts[k].idx,
      end,
      tStart: starts[k].t,
      tEnd: next ? next.t : s[s.length - 1].t,
      complete: !!next,
    });
  }
  return laps;
}

/** Resample a lap's samples onto a distance grid scaled to the track length. */
function resample(s: Sample[], raw: RawLap, lengthM: number, step: number): LapTrace | null {
  const seg = s.slice(raw.start, raw.end + 1);
  if (seg.length < 10) return null;
  const d0 = seg[0].d;
  const total = seg[seg.length - 1].d - d0;
  if (total < lengthM * 0.85 || total > lengthM * 1.2) return null;
  const k = lengthM / total;
  const n = Math.floor(lengthM / step) + 1;
  const t = new Float64Array(n);
  const v = new Float64Array(n);
  const lat = new Float64Array(n);
  const lon = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const x = i * step;
    while (j < seg.length - 2 && (seg[j + 1].d - d0) * k < x) j++;
    const a = seg[j];
    const b = seg[j + 1];
    const xa = (a.d - d0) * k;
    const xb = (b.d - d0) * k;
    const f = xb > xa ? Math.min(1, Math.max(0, (x - xa) / (xb - xa))) : 0;
    t[i] = a.t + f * (b.t - a.t) - raw.tStart;
    v[i] = (a.v + f * (b.v - a.v)) * 3.6;
    lat[i] = a.lat + f * (b.lat - a.lat);
    lon[i] = a.lon + f * (b.lon - a.lon);
  }
  // The grid end is the line; pin it to the logged lap time.
  t[n - 1] = raw.tEnd - raw.tStart;
  return { lap: raw.lap, time: raw.tEnd - raw.tStart, kind: 'flying', t, v, lat, lon };
}

export function buildLaps(p: ParsedSession, track: TrackDef, step: number): LapTrace[] {
  const raws = splitLaps(p, track).filter((r) => r.complete);
  const traces: LapTrace[] = [];
  for (const r of raws) {
    const tr = resample(p.samples, r, track.lengthM, step);
    if (tr) traces.push(tr);
  }
  if (!traces.length) return traces;
  const best = Math.min(...traces.map((l) => l.time));
  traces.forEach((l, i) => {
    let kind: LapKind = 'flying';
    // A lap that starts from very low speed was started from the pits / a standstill.
    if (l.v[0] < 30) kind = 'out';
    else if (l.time > best * 1.07) kind = 'slow';
    else if (i === 0 && l.time > best * 1.03) kind = 'warmup';
    l.kind = kind;
  });
  return traces;
}
