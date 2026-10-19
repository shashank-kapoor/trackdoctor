import { describe, expect, it } from 'vitest';
import { median } from './analyze';
import { coachCorner, pickFocus, type CornerCoaching } from './coach';
import type { CornerAnalysis, CornerDef, CornerLap, Diagnosis } from './types';

const def = (id: string): CornerDef => ({ id, name: id, direction: 'R', kind: 'hairpin', apex: [0, 0], blurb: '', tips: [] });

const lap = (n: number, loss: number, over: Partial<CornerLap> = {}): CornerLap => ({
  lap: n,
  sectionTime: 10 + loss,
  loss,
  minSpeed: 60,
  minAt: 100,
  entrySpeed: 120,
  brakeAt: 50,
  exitSpeed: 90,
  throttleAt: 110,
  dips: 1,
  peakDecelG: 0.8,
  ...over,
});

function corner(id: string, losses: number[]): CornerAnalysis {
  const laps = losses.map((l, i) => lap(i + 1, l));
  return {
    def: def(id),
    apexS: 0,
    sectionStart: 0,
    sectionEnd: 0,
    laps,
    best: laps.find((l) => l.loss === 0)!,
    meanLoss: losses.reduce((s, x) => s + x, 0) / losses.length,
    medianLoss: median(losses),
    maxLoss: Math.max(...losses),
    minSpeedSpread: 0,
  };
}

/** Coaching with a forced main diagnosis, so the linking rule can be tested in isolation. */
const cc = (id: string, losses: number[], main: Diagnosis | null = 'over-slowed'): CornerCoaching => ({
  ...coachCorner(corner(id, losses)),
  main,
});

describe('median', () => {
  it('averages the middle pair for even counts', () => {
    expect(median([0, 1, 3, 10])).toBe(2);
    expect(median([5, 0, 1])).toBe(1);
  });
});

describe('pickFocus', () => {
  it('ranks a consistent habit above a single bad lap', () => {
    const oneBadLap = cc('T9', [0, 0.1, 0.2, 0.2, 3.0]); // mean 0.70, median 0.2
    const habit = cc('T3', [0, 0.5, 0.6, 0.6, 0.7]); // mean 0.48, median 0.6
    const minor = cc('T1', [0, 0.1, 0.1, 0.2, 0.2]);
    const top = pickFocus([minor, habit, oneBadLap]).map((f) => f.label);
    expect(top[0]).toBe('T3');
  });

  it('merges a slow-approach corner into the corner before it', () => {
    const t4 = cc('T4', [0, 0.3, 0.3, 0.4, 0.4]);
    const t5 = cc('T5', [0, 0.5, 0.6, 0.6, 0.7], 'slow-approach');
    const t6 = cc('T6', [0, 0.4, 0.4, 0.5, 0.5]);
    const focus = pickFocus([t4, t5, t6]);
    expect(focus.map((f) => f.label)).toEqual(['T4 → T5', 'T6']);
    expect(focus[0].score).toBeCloseTo(0.3 + 0.6);
    expect(focus[0].linked?.corner.def.id).toBe('T5');
    expect(focus[0].primary).toMatch(/also fixes T5/);
  });

  it('links T1 back to the last corner across the line', () => {
    const t1 = cc('T1', [0, 0.5, 0.5, 0.5, 0.5], 'slow-approach');
    const t2 = cc('T2', [0, 0.1, 0.1, 0.1, 0.1]);
    const t9 = cc('T9', [0, 0.2, 0.2, 0.2, 0.2]);
    expect(pickFocus([t1, t2, t9])[0].label).toBe('T9 → T1');
  });

  it("doesn't chain merges", () => {
    const a = cc('T4', [0, 0.2, 0.2, 0.2, 0.2]);
    const b = cc('T5', [0, 0.3, 0.3, 0.3, 0.3], 'slow-approach');
    const c = cc('T6', [0, 0.4, 0.4, 0.4, 0.4], 'slow-approach');
    const labels = pickFocus([a, b, c]).map((f) => f.label);
    expect(labels).toContain('T4 → T5');
    expect(labels).toContain('T6');
  });
});

describe('focus priority', () => {
  it('gives picks within 0.1 s the same priority', () => {
    const focus = pickFocus([
      cc('T5', [0, 1.0, 1.1, 1.2, 1.3]), // median 1.10
      cc('T3', [0, 1.0, 1.09, 1.2, 1.3]), // median 1.09
      cc('T9', [0, 0.5, 0.88, 1.0, 2.5]), // median 0.88
    ]);
    expect(focus.map((f) => [f.label, f.rank, f.tied])).toEqual([
      ['T5', 1, true],
      ['T3', 1, true],
      ['T9', 2, false],
    ]);
  });

  it('keeps a strict order when gaps are clear', () => {
    const focus = pickFocus([cc('A', [0, 1, 1, 1, 1]), cc('B', [0, 0.5, 0.5, 0.5, 0.5]), cc('C', [0, 0.2, 0.2, 0.2, 0.2])]);
    expect(focus.map((f) => f.rank)).toEqual([1, 2, 3]);
    expect(focus.some((f) => f.tied)).toBe(false);
  });
});

describe('one-off flag', () => {
  it('flags a corner where one lap holds most of the loss', () => {
    expect(coachCorner(corner('T9', [0, 0.3, 0.9, 1.1, 2.5])).oneOff).toMatch(/Lap 5 lost 2.50 s/);
  });
  it('stays quiet when losses are spread out', () => {
    expect(coachCorner(corner('T3', [0, 0.5, 1.1, 1.3, 1.5])).oneOff).toBeNull();
  });
});
