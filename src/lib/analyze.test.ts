import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { winton } from '../tracks/winton';
import { analyze } from './analyze';
import { coachSession } from './coach';

const csv = readFileSync(new URL('../../public/samples/winton-sample.csv', import.meta.url), 'utf8');

describe('Winton sample session', () => {
  const a = analyze(csv, winton);
  const coach = coachSession(a);

  it('finds the six timed laps and the best lap', () => {
    expect(a.laps.map((l) => l.lap)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(a.bestLap).toBe(6);
    expect(a.laps[5].time).toBeCloseTo(107.43, 1);
  });

  it('detects 1 Hz GPS', () => {
    expect(a.parsed.gpsRateHz).toBeGreaterThan(0.8);
    expect(a.parsed.gpsRateHz).toBeLessThan(1.3);
    expect(coach.dataQuality.note).toMatch(/once a second/);
  });

  it('section times add up to each lap time', () => {
    for (const lap of a.laps.filter((l) => a.validLaps.includes(l.lap))) {
      const sum = a.corners.reduce((s, c) => s + c.laps.find((x) => x.lap === lap.lap)!.sectionTime, 0);
      expect(sum).toBeCloseTo(lap.time, 3);
    }
  });

  it('ideal lap is ~2–3 s under the best', () => {
    const gain = a.laps[5].time - a.idealTime;
    expect(gain).toBeGreaterThan(1.8);
    expect(gain).toBeLessThan(3.5);
  });

  it('matches the hand analysis on key corners', () => {
    const t4 = a.corners.find((c) => c.def.id === 'T4')!;
    expect(t4.laps.find((l) => l.lap === 6)!.minSpeed).toBeCloseTo(53.6, 0);
    const t9 = a.corners.find((c) => c.def.id === 'T9')!;
    expect(t9.laps.find((l) => l.lap === 2)!.minSpeed).toBeLessThan(55);
    expect(t9.maxLoss).toBeGreaterThan(1.5);
  });

  it('produces coaching for every corner', () => {
    expect(coach.corners).toHaveLength(9);
    expect(coach.focus).toHaveLength(3);
    for (const c of coach.corners) expect(c.primary.length).toBeGreaterThan(10);
  });
});
