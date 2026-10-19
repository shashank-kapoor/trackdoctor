import { createStore, del, get, set, values } from 'idb-keyval';
import type { SessionCoaching } from './coach';
import type { SessionAnalysis } from './types';

const metaStore = createStore('trackdoctor-meta', 'sessions');
const csvStore = createStore('trackdoctor-csv', 'files');

export interface CornerSummary {
  id: string;
  bestSection: number;
  meanLoss: number;
  targetMin: number;
  meanMin: number;
  minSpread: number;
}

export interface SessionSummary {
  id: string;
  trackId: string;
  fileName: string;
  dateMs: number;
  addedMs: number;
  bestLap: number;
  idealTime: number;
  lapCount: number;
  lapTimes: number[];
  exclude: number[];
  include: number[];
  corners: CornerSummary[];
  focus: string[];
}

export function summarize(
  id: string,
  fileName: string,
  a: SessionAnalysis,
  c: SessionCoaching,
  prev?: Pick<SessionSummary, 'addedMs' | 'include'>,
): SessionSummary {
  const best = a.laps.find((l) => l.lap === a.bestLap)!;
  return {
    id,
    trackId: a.track.id,
    fileName,
    dateMs: a.dateMs,
    addedMs: prev?.addedMs ?? Date.now(),
    bestLap: best.time,
    idealTime: a.idealTime,
    lapCount: a.laps.length,
    lapTimes: a.laps.map((l) => l.time),
    exclude: a.excluded,
    include: prev?.include ?? [],
    corners: a.corners.map((k) => ({
      id: k.def.id,
      bestSection: k.best.sectionTime,
      meanLoss: k.meanLoss,
      targetMin: k.best.minSpeed,
      meanMin: k.laps.reduce((s, l) => s + l.minSpeed, 0) / k.laps.length,
      minSpread: k.minSpeedSpread,
    })),
    focus: c.focus.map((f) => f.corner.def.id),
  };
}

export async function saveSession(s: SessionSummary, csv?: string) {
  if (csv !== undefined) await set(s.id, csv, csvStore);
  await set(s.id, s, metaStore);
}

export const loadCsv = (id: string) => get<string>(id, csvStore);
export const loadSummary = (id: string) => get<SessionSummary>(id, metaStore);

export async function listSessions(trackId?: string): Promise<SessionSummary[]> {
  const all = (await values<SessionSummary>(metaStore)).filter((s) => !trackId || s.trackId === trackId);
  return all.sort((a, b) => b.dateMs - a.dateMs);
}

export async function deleteSession(id: string) {
  await del(id, metaStore);
  await del(id, csvStore);
}

/** Stable id for a file so re-uploading the same session opens the existing one. */
export async function sessionId(trackId: string, csv: string): Promise<string> {
  const data = new TextEncoder().encode(trackId + '\n' + csv);
  try {
    const h = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(h)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // crypto.subtle is unavailable on plain-http LAN addresses; fall back to a cheap hash.
    let x = 2166136261;
    for (let i = 0; i < data.length; i += 7) x = Math.imul(x ^ data[i], 16777619);
    return (x >>> 0).toString(16) + data.length.toString(16);
  }
}
