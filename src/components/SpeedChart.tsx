import { useEffect, useMemo, useRef, useState } from 'react';
import type { CornerAnalysis, LapTrace } from '../lib/types';

interface Props {
  lap: LapTrace;
  cmp: LapTrace | null;
  corners: CornerAnalysis[];
  step: number;
  range: [number, number];
  selected: string | null;
  onSelectCorner: (id: string) => void;
  scrubIdx: number | null;
  onScrub: (i: number | null) => void;
  height?: number;
}

const PAD_L = 34;
const PAD_R = 8;
const TOP = 20;

export default function SpeedChart({ lap, cmp, corners, step, range, selected, onSelectCorner, scrubIdx, onScrub, height = 190 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const speedH = Math.round((height - TOP) * 0.68);
  const deltaTop = TOP + speedH + 14;
  const deltaH = height - deltaTop - 4;
  const i0 = Math.max(0, Math.floor(range[0] / step));
  const i1 = Math.min(lap.v.length - 1, Math.ceil(range[1] / step));
  const plotW = w - PAD_L - PAD_R;
  const x = (i: number) => PAD_L + ((i - i0) / Math.max(1, i1 - i0)) * plotW;

  const { vLo, vHi, ticks } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const tr of cmp ? [lap, cmp] : [lap])
      for (let i = i0; i <= i1; i++) {
        lo = Math.min(lo, tr.v[i]);
        hi = Math.max(hi, tr.v[i]);
      }
    const span = hi - lo;
    const tickStep = span > 100 ? 50 : span > 40 ? 20 : 10;
    const vLo = Math.max(0, Math.floor((lo - 4) / tickStep) * tickStep);
    const vHi = Math.ceil((hi + 4) / tickStep) * tickStep;
    const ticks: number[] = [];
    for (let t = vLo; t <= vHi; t += tickStep) ticks.push(t);
    return { vLo, vHi, ticks };
  }, [lap, cmp, i0, i1]);
  const y = (v: number) => TOP + speedH - ((v - vLo) / (vHi - vLo || 1)) * speedH;

  const pathFor = (tr: LapTrace) => {
    const stride = Math.max(1, Math.floor((i1 - i0) / plotW));
    let d = '';
    for (let i = i0; i <= i1; i += stride) d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(tr.v[i]).toFixed(1)}`;
    return d;
  };

  const delta = useMemo(() => {
    if (!cmp) return null;
    const base = lap.t[i0] - cmp.t[i0];
    const vals: number[] = [];
    let max = 0.1;
    for (let i = i0; i <= i1; i++) {
      const d = lap.t[i] - cmp.t[i] - base;
      vals.push(d);
      max = Math.max(max, Math.abs(d));
    }
    return { vals, max };
  }, [lap, cmp, i0, i1]);

  const dy = (d: number) => deltaTop + deltaH / 2 - (d / (delta?.max || 1)) * (deltaH / 2);
  const deltaPath = (sign: 1 | -1) => {
    if (!delta) return '';
    const stride = Math.max(1, Math.floor((i1 - i0) / plotW));
    let d = `M${x(i0)},${dy(0)}`;
    for (let i = i0; i <= i1; i += stride) {
      const v = delta.vals[i - i0];
      d += `L${x(i).toFixed(1)},${dy(sign > 0 ? Math.max(0, v) : Math.min(0, v)).toFixed(1)}`;
    }
    return d + `L${x(i1)},${dy(0)}Z`;
  };

  const toIdx = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    const f = (clientX - r.left - PAD_L) / plotW;
    return Math.max(i0, Math.min(i1, Math.round(i0 + f * (i1 - i0))));
  };
  const dragging = useRef(false);

  const visible = corners.filter((c) => c.apexS >= range[0] - 20 && c.apexS <= range[1] + 20);
  const si = scrubIdx !== null && scrubIdx >= i0 && scrubIdx <= i1 ? scrubIdx : null;
  const readDelta = si !== null && delta ? delta.vals[si - i0] : delta ? delta.vals[delta.vals.length - 1] : null;

  return (
    <div>
      <div className="chart-head">
        <span className="key">
          <span className="ln" style={{ background: 'var(--accent)' }} /> Lap {lap.lap}
        </span>
        {cmp && (
          <span className="key">
            <span className="ln" style={{ background: 'var(--ref)' }} /> Lap {cmp.lap}
          </span>
        )}
        <span className="spacer" />
        <span className="chart-readout">
          {si !== null ? (
            <>
              <span className="dim">{Math.round(si * step)} m · </span>
              <span style={{ color: 'var(--accent)' }}>{Math.round(lap.v[si])}</span>
              {cmp && (
                <>
                  <span className="dim"> vs </span>
                  <span style={{ color: 'var(--ref)' }}>{Math.round(cmp.v[si])}</span>
                </>
              )}
              <span className="dim"> km/h</span>
            </>
          ) : (
            <span className="dim">{selected ? 'Corner' : 'Full lap'} · drag to scrub</span>
          )}
          {readDelta !== null && (
            <span className={readDelta > 0 ? 'delta-bad' : 'delta-good'}>
              {'  '}
              {readDelta > 0 ? '+' : ''}
              {readDelta.toFixed(2)}s
            </span>
          )}
        </span>
      </div>
      <div ref={wrap}>
        <svg
          className="chart-svg"
          width={w}
          height={height}
          viewBox={`0 0 ${w} ${height}`}
          onPointerDown={(e) => {
            dragging.current = true;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            onScrub(toIdx(e.clientX));
          }}
          onPointerMove={(e) => {
            if (e.pointerType === 'mouse' || dragging.current) onScrub(toIdx(e.clientX));
          }}
          onPointerUp={() => (dragging.current = false)}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') onScrub(null);
          }}
        >
          {visible.map((c, k) => {
            const xa = x(Math.max(i0, c.sectionStart / step));
            const xb = x(Math.min(i1, c.sectionEnd / step));
            const on = c.def.id === selected;
            return (
              <g key={c.def.id}>
                {(k % 2 === 0 || on) && (
                  <rect
                    x={xa}
                    y={TOP}
                    width={Math.max(0, xb - xa)}
                    height={speedH}
                    fill={on ? 'var(--accent-soft)' : 'var(--surface)'}
                    opacity={on ? 1 : 0.6}
                  />
                )}
                <text
                  x={x(c.apexS / step)}
                  y={13}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={on ? 'var(--accent)' : 'var(--text-3)'}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelectCorner(c.def.id);
                  }}
                >
                  {c.def.id}
                </text>
              </g>
            );
          })}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={w - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--text-3)">
                {t}
              </text>
            </g>
          ))}
          {cmp && <path d={pathFor(cmp)} fill="none" stroke="var(--ref)" strokeWidth="1.6" strokeDasharray="5 4" opacity="0.9" />}
          <path d={pathFor(lap)} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
          {delta && (
            <g>
              <text x={PAD_L - 6} y={deltaTop + 4} textAnchor="end" fontSize="9.5" fill="var(--text-3)">
                +{delta.max.toFixed(1)}
              </text>
              <text x={PAD_L - 6} y={deltaTop + deltaH} textAnchor="end" fontSize="9.5" fill="var(--text-3)">
                −{delta.max.toFixed(1)}
              </text>
              <line x1={PAD_L} x2={w - PAD_R} y1={dy(0)} y2={dy(0)} stroke="var(--line-2)" />
              <path d={deltaPath(1)} fill="var(--bad)" opacity="0.55" />
              <path d={deltaPath(-1)} fill="var(--good)" opacity="0.55" />
              <text x={PAD_L + 4} y={deltaTop - 3} fontSize="10" fill="var(--text-3)">
                Time vs Lap {cmp?.lap} (above = slower)
              </text>
            </g>
          )}
          {si !== null && (
            <g pointerEvents="none">
              <line x1={x(si)} x2={x(si)} y1={TOP} y2={height - 4} stroke="var(--text)" strokeWidth="1" opacity="0.5" />
              <circle cx={x(si)} cy={y(lap.v[si])} r="4" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
              {cmp && <circle cx={x(si)} cy={y(cmp.v[si])} r="3.5" fill="var(--ref)" stroke="var(--bg)" strokeWidth="2" />}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
