import type { LatLon } from './types';

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: LatLon, b: LatLon): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Local flat projection in metres around a reference latitude. Good enough for a race track. */
export function toXY(p: LatLon, ref: LatLon): [number, number] {
  return [rad(p[1] - ref[1]) * R * Math.cos(rad(ref[0])), rad(p[0] - ref[0]) * R];
}

/**
 * If segment a→b crosses segment c→d, returns the fraction along a→b where it crosses.
 */
export function segmentCross(a: LatLon, b: LatLon, c: LatLon, d: LatLon): number | null {
  const [ax, ay] = toXY(a, c);
  const [bx, by] = toXY(b, c);
  const [cx, cy] = [0, 0];
  const [dx, dy] = toXY(d, c);
  const den = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / den;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}
