export type LatLon = [number, number];

/** One raw logger row, normalised. Speed in m/s, time in s, distance in m. */
export interface Sample {
  t: number;
  d: number;
  lat: number;
  lon: number;
  v: number;
  lap: number | null;
}

export interface ParsedSession {
  title?: string;
  trackName?: string;
  created?: string;
  source: 'racechrono' | 'generic';
  samples: Sample[];
  /** Real GPS update rate (Hz), if we could tell. */
  gpsRateHz: number | null;
}

export type LapKind = 'out' | 'warmup' | 'flying' | 'slow';

/** A lap resampled onto a fixed distance grid (index i ↔ i * step metres). */
export interface LapTrace {
  lap: number;
  time: number;
  kind: LapKind;
  /** Cumulative time from the line at each grid point (s). */
  t: Float64Array;
  /** Speed (km/h). */
  v: Float64Array;
  lat: Float64Array;
  lon: Float64Array;
}

export type CornerKind = 'hairpin' | 'fast' | 'sweeper' | 'heavy-brake' | 'complex';

export interface CornerDef {
  id: string;
  name: string;
  direction: 'L' | 'R';
  kind: CornerKind;
  /** Where the slowest point usually is. Used to locate the corner on any lap. */
  apex: LatLon;
  /** Short line shown under the corner name. */
  blurb: string;
  /** Track-specific technique tips that always apply to this corner. */
  tips: string[];
}

export interface TrackDef {
  id: string;
  name: string;
  venue: string;
  location: string;
  lengthM: number;
  /** Start/finish line as two points across the track. */
  startLine: [LatLon, LatLon];
  center: LatLon;
  zoom: number;
  corners: CornerDef[];
  /** Simplified outline for thumbnails. */
  outline: LatLon[];
  available: boolean;
}

export interface CornerLap {
  lap: number;
  sectionTime: number;
  loss: number;
  minSpeed: number;
  minAt: number;
  entrySpeed: number;
  brakeAt: number;
  exitSpeed: number;
  throttleAt: number;
  dips: number;
  peakDecelG: number;
}

export type Diagnosis =
  | 'good'
  | 'slowed-twice'
  | 'overdriven'
  | 'over-slowed'
  | 'hot-entry'
  | 'late-throttle'
  | 'late-apex'
  | 'slow-approach'
  | 'line';

export interface CornerAnalysis {
  def: CornerDef;
  /** Distance of the corner (slowest point) from the line, on the shared grid. */
  apexS: number;
  sectionStart: number;
  sectionEnd: number;
  laps: CornerLap[];
  best: CornerLap;
  meanLoss: number;
  maxLoss: number;
  minSpeedSpread: number;
}

export interface SessionAnalysis {
  track: TrackDef;
  parsed: ParsedSession;
  step: number;
  gridLen: number;
  laps: LapTrace[];
  /** Laps used for coaching (flying, not obviously slow, not excluded). */
  validLaps: number[];
  excluded: number[];
  bestLap: number;
  idealTime: number;
  corners: CornerAnalysis[];
  dateMs: number;
}
