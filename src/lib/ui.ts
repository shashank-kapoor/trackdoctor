import { useEffect, useState } from 'react';
import type { Diagnosis } from './types';

const SPEED_STOPS: [number, [number, number, number]][] = [
  [0, [232, 54, 79]],
  [0.3, [255, 138, 42]],
  [0.55, [255, 210, 63]],
  [0.8, [94, 224, 122]],
  [1, [47, 198, 255]],
];

const mix = (a: number[], b: number[], f: number) => a.map((x, i) => Math.round(x + (b[i] - x) * f));
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

export function speedColor(v: number, lo: number, hi: number): string {
  const f = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)));
  for (let i = 1; i < SPEED_STOPS.length; i++) {
    const [p1, c1] = SPEED_STOPS[i];
    const [p0, c0] = SPEED_STOPS[i - 1];
    if (f <= p1) return rgb(mix(c0, c1, (f - p0) / (p1 - p0)));
  }
  return rgb(SPEED_STOPS[SPEED_STOPS.length - 1][1]);
}

export const SPEED_GRADIENT = `linear-gradient(90deg, ${SPEED_STOPS.map(([p, c]) => `${rgb(c)} ${p * 100}%`).join(', ')})`;

/** rate: seconds lost per metre vs the comparison lap (negative = gaining). */
export function deltaColor(rate: number): string {
  const f = Math.min(1, Math.abs(rate) / 0.004);
  const neutral = [205, 210, 218];
  return rgb(mix(neutral, rate > 0 ? [255, 64, 84] : [40, 214, 120], Math.pow(f, 0.7)));
}

export type Severity = 'high' | 'medium' | 'low';
export const severityOf = (loss: number): Severity => (loss >= 0.5 ? 'high' : loss >= 0.2 ? 'medium' : 'low');

export const DIAG_COLOR: Record<Diagnosis, string> = {
  good: 'var(--good)',
  'slowed-twice': 'var(--warn)',
  overdriven: 'var(--bad)',
  'over-slowed': 'var(--warn)',
  'hot-entry': 'var(--bad)',
  'late-throttle': 'var(--warn)',
  'late-apex': 'var(--warn)',
  'slow-approach': 'var(--ref)',
  line: 'var(--text-3)',
};

export function useMedia(q: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}

export const fmtLoss = (s: number) => (s < 0.005 ? 'Best' : `+${s.toFixed(2)}`);

export function fmtDate(ms: number, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(ms).toLocaleDateString(undefined, opts);
}
