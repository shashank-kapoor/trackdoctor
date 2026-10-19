import type { CornerAnalysis, CornerLap, Diagnosis, SessionAnalysis } from './types';

export interface LapVerdict {
  diagnosis: Diagnosis;
  title: string;
  detail: string;
}

export interface CornerCoaching {
  corner: CornerAnalysis;
  headline: string;
  target: { min: number; lo: number; hi: number };
  pattern: string | null;
  primary: string;
  dos: string[];
  severity: 'high' | 'medium' | 'low';
  verdicts: Map<number, LapVerdict>;
}

export interface SessionCoaching {
  corners: CornerCoaching[];
  focus: CornerCoaching[];
  keyFinding: string | null;
  dataQuality: { rateHz: number | null; brakeErrorM: number | null; note: string | null };
  consistency: number;
}

const r0 = (x: number) => Math.round(x);
const s2 = (x: number) => x.toFixed(2);

export const DIAG_LABEL: Record<Diagnosis, string> = {
  good: 'On the money',
  'slowed-twice': 'Slowed twice',
  overdriven: 'Braked late, lost speed',
  'over-slowed': 'Too slow at the apex',
  'hot-entry': 'Too fast in, slow out',
  'late-throttle': 'Late on the throttle',
  'late-apex': 'Apex too deep',
  'slow-approach': 'Slow approach',
  line: 'Small losses through the corner',
};

/** Compare one lap's run through a corner with the driver's best run through that corner. */
export function diagnose(c: CornerAnalysis, l: CornerLap): LapVerdict {
  const ref = c.best;
  const refName = `Lap ${ref.lap}`;
  const dMin = l.minSpeed - ref.minSpeed;
  const dExit = l.exitSpeed - ref.exitSpeed;
  const dBrake = l.brakeAt - ref.brakeAt; // + = braked later
  const dEntry = l.entrySpeed - ref.entrySpeed;
  const lost = `Lost ${s2(l.loss)} s vs ${refName}.`;
  if (l.lap === ref.lap || l.loss < 0.08)
    return { diagnosis: 'good', title: DIAG_LABEL.good, detail: l.lap === ref.lap ? 'Your best run through here.' : `Within ${s2(l.loss)} s of your best.` };
  if (l.dips >= 2 && ref.dips < 2)
    return {
      diagnosis: 'slowed-twice',
      title: DIAG_LABEL['slowed-twice'],
      detail: `Speed dipped twice through the corner — a mid-corner lift or second brake. ${lost}`,
    };
  if (dMin <= -4 && dBrake > 10)
    return {
      diagnosis: 'overdriven',
      title: DIAG_LABEL.overdriven,
      detail: `Braked later than ${refName} but came out ${r0(-dMin)} km/h slower at the apex (${r0(l.minSpeed)} vs ${r0(ref.minSpeed)}). ${lost}`,
    };
  if (dMin <= -3)
    return {
      diagnosis: 'over-slowed',
      title: DIAG_LABEL['over-slowed'],
      detail: `${r0(l.minSpeed)} km/h at the slowest point vs ${r0(ref.minSpeed)} on ${refName}. ${lost}`,
    };
  if (dMin >= 3 && dExit <= -4)
    return {
      diagnosis: 'hot-entry',
      title: DIAG_LABEL['hot-entry'],
      detail: `Carried ${r0(dMin)} km/h more to the apex but exited ${r0(-dExit)} km/h slower. ${lost}`,
    };
  const dApex = l.minAt - ref.minAt;
  if (dApex >= 16 && l.loss >= 0.2)
    return {
      diagnosis: 'late-apex',
      title: DIAG_LABEL['late-apex'],
      detail: `Reached the slowest point ${r0(dApex)} m later than ${refName} — went in deep, so the throttle came late. ${lost}`,
    };
  if (dExit <= -4)
    return {
      diagnosis: 'late-throttle',
      title: DIAG_LABEL['late-throttle'],
      detail: `Similar apex speed, but ${r0(-dExit)} km/h slower 100 m later (${r0(l.exitSpeed)} vs ${r0(ref.exitSpeed)}). ${lost}`,
    };
  if (dEntry <= -5)
    return {
      diagnosis: 'slow-approach',
      title: DIAG_LABEL['slow-approach'],
      detail: `Arrived ${r0(-dEntry)} km/h slower — the time went on the exit of the corner before. ${lost}`,
    };
  return { diagnosis: 'line', title: DIAG_LABEL.line, detail: `No single big mistake — small losses through the section. ${lost}` };
}

const ACTION: Record<Exclude<Diagnosis, 'good'>, (c: CornerAnalysis, t: number) => string> = {
  'slowed-twice': () => 'Commit to one smooth slow-down. Set your speed on entry, then hold a steady throttle to the apex — no second brake or lift.',
  overdriven: (_c, t) => `Brake a touch earlier and release progressively. Braking later isn't buying you time here — aim for ${t} km/h at the slowest point.`,
  'over-slowed': (c, t) =>
    c.def.kind === 'sweeper' || c.def.kind === 'fast'
      ? `Carry more speed: a brief lift, turn in, and back to throttle early. Target ${t} km/h at the slowest point.`
      : `Brake less, not later. Ease off the brake earlier and let the car roll ${t} km/h through the apex.`,
  'hot-entry': (_c, t) => `Slow in, fast out. Give up a little entry speed (≈${t} km/h at the apex) so you can get on the throttle earlier.`,
  'late-apex': (_c, t) => `Brake a touch earlier so the car is slowed to ~${t} km/h sooner, hit the apex on time, then open the steering and go to full throttle.`,
  'late-throttle': () => 'Get the car rotated by the apex, then unwind the steering and squeeze the throttle earlier.',
  'slow-approach': (c) => `Your time here is lost on the exit of the corner before ${c.def.id} — fix that exit and this one comes free.`,
  line: () => 'Small, spread-out losses. Focus on a consistent turn-in point and hitting the same apex every lap.',
};

function headline(c: CornerAnalysis, main: Diagnosis | null, t: number): string {
  if (!main) return `Repeat it — ${t} km/h`;
  switch (main) {
    case 'slowed-twice':
      return 'One smooth slow-down';
    case 'overdriven':
      return `Brake earlier, carry ${t}`;
    case 'over-slowed':
      return c.def.kind === 'sweeper' || c.def.kind === 'fast' ? `Commit — hold ${t} km/h` : `Carry ${t} km/h`;
    case 'hot-entry':
      return 'Slow in, fast out';
    case 'late-throttle':
      return 'Throttle earlier';
    case 'late-apex':
      return 'Apex earlier, exit faster';
    case 'slow-approach':
      return 'Fix the previous exit';
    default:
      return 'Same line every lap';
  }
}

export function coachCorner(c: CornerAnalysis): CornerCoaching {
  const verdicts = new Map<number, LapVerdict>();
  const counts = new Map<Diagnosis, number>();
  const lossBy = new Map<Diagnosis, number>();
  for (const l of c.laps) {
    const v = diagnose(c, l);
    verdicts.set(l.lap, v);
    if (v.diagnosis !== 'good') {
      counts.set(v.diagnosis, (counts.get(v.diagnosis) ?? 0) + 1);
      lossBy.set(v.diagnosis, (lossBy.get(v.diagnosis) ?? 0) + l.loss);
    }
  }
  // The most costly pattern drives the advice.
  let main: Diagnosis | null = null;
  for (const [d, loss] of lossBy) if (!main || loss > (lossBy.get(main) ?? 0)) main = d;
  const t = r0(c.best.minSpeed);
  const target = { min: t, lo: t - 2, hi: t + 2 };
  const others = c.laps.length - 1;
  const pattern = main
    ? `${counts.get(main)} of ${others} other lap${others === 1 ? '' : 's'}: ${DIAG_LABEL[main].toLowerCase()}.`
    : null;
  const primary = main
    ? ACTION[main as Exclude<Diagnosis, 'good'>](c, t)
    : `You're consistent here. Keep hitting ~${t} km/h at the slowest point.`;
  const severity = c.meanLoss >= 0.5 ? 'high' : c.meanLoss >= 0.2 ? 'medium' : 'low';
  return {
    corner: c,
    headline: headline(c, main, t),
    target,
    pattern,
    primary,
    dos: [primary, ...c.def.tips],
    severity,
    verdicts,
  };
}

export function coachSession(a: SessionAnalysis): SessionCoaching {
  const corners = a.corners.map(coachCorner);
  const focus = [...corners].sort((x, y) => y.corner.meanLoss - x.corner.meanLoss).slice(0, 3);

  // Key finding: is the driver mostly over-slowing, or over-driving?
  let slow = 0;
  let over = 0;
  let laterAndSlower = 0;
  let laterTotal = 0;
  for (const cc of corners) {
    for (const l of cc.corner.laps) {
      const d = cc.verdicts.get(l.lap)!.diagnosis;
      if (d === 'over-slowed' || d === 'slowed-twice') slow++;
      if (d === 'overdriven' || d === 'hot-entry') over++;
      if (l.lap !== cc.corner.best.lap && l.brakeAt - cc.corner.best.brakeAt > 10) {
        laterTotal++;
        if (l.loss > 0.15) laterAndSlower++;
      }
    }
  }
  let keyFinding: string | null = null;
  const speeds = a.corners.map((c) => c.minSpeedSpread);
  const spread = Math.round(Math.max(...speeds));
  if (slow > over * 1.5 && slow >= 3) {
    keyFinding = `Your slowest point in a corner varies by up to ${spread} km/h lap to lap. Most lost time comes from slowing too much — braking harder or longer than needed and getting back to throttle late. You don't need to brake later; you need to carry more speed.`;
    if (laterTotal >= 3 && laterAndSlower / laterTotal >= 0.5)
      keyFinding += ` In fact, ${laterAndSlower} of ${laterTotal} times you braked later than your best, you were slower.`;
  } else if (over > slow * 1.5 && over >= 3) {
    keyFinding = `You're often over-driving the entry: braking late, then losing speed mid-corner. Brake a touch earlier and focus on exit speed — your best runs are the calmer ones.`;
  } else if (slow + over >= 3) {
    keyFinding = `Your slowest point in a corner varies by up to ${spread} km/h lap to lap. The fastest gains come from hitting a target speed at each corner every lap, not from finding new limits.`;
  }

  const rate = a.parsed.gpsRateHz;
  const vMax = Math.max(...a.laps.map((l) => Math.max(...l.v)));
  const brakeErrorM = rate && rate < 5 ? Math.round(((vMax / 3.6) * (1 / rate)) / 2 / 5) * 5 : null;
  const note =
    rate && rate < 5
      ? `Your GPS updates about ${rate < 1.5 ? 'once a second' : `${Math.round(rate)} times a second`}. Corner speeds and section times are reliable, but braking points are only accurate to about ±${brakeErrorM} m at top speed — treat them as "earlier/later" hints. A 10 Hz GPS receiver would sharpen braking advice.`
      : null;

  const times = a.laps.filter((l) => a.validLaps.includes(l.lap)).map((l) => l.time);
  const mean = times.reduce((s, x) => s + x, 0) / times.length;
  const sd = Math.sqrt(times.reduce((s, x) => s + (x - mean) ** 2, 0) / times.length);

  return { corners, focus, keyFinding, dataQuality: { rateHz: rate, brakeErrorM, note }, consistency: sd };
}

export function fmtLap(s: number): string {
  if (!isFinite(s)) return '—';
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(2).padStart(5, '0')}`;
}
