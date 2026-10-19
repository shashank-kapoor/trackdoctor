import { useEffect, useState } from 'react';
import { fmtLap } from '../lib/coach';
import { listSessions, type SessionSummary } from '../lib/store';
import { fmtDate } from '../lib/ui';
import { IconCheck, IconWarn } from './Icons';

interface Props {
  trackId: string;
  current: SessionSummary;
  onOpen: (id: string) => void;
}

function TrendChart({ sessions }: { sessions: SessionSummary[] }) {
  const w = 360;
  const h = 150;
  const pad = { l: 44, r: 10, t: 12, b: 24 };
  const vals = sessions.flatMap((s) => [s.bestLap, s.idealTime]);
  const lo = Math.floor(Math.min(...vals) - 0.5);
  const hi = Math.ceil(Math.max(...vals) + 0.5);
  const x = (i: number) => pad.l + (sessions.length === 1 ? (w - pad.l - pad.r) / 2 : (i / (sessions.length - 1)) * (w - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (h - pad.t - pad.b);
  const line = (k: 'bestLap' | 'idealTime') => sessions.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s[k])}`).join('');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: 'block' }}>
      {[lo, (lo + hi) / 2, hi].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={pad.l - 6} y={y(t) + 4} fontSize="10" textAnchor="end" fill="var(--text-3)">
            {fmtLap(t).replace(/\.\d+$/, '')}
          </text>
        </g>
      ))}
      <path d={line('idealTime')} fill="none" stroke="var(--good)" strokeWidth="2" strokeDasharray="5 4" />
      <path d={line('bestLap')} fill="none" stroke="var(--purple)" strokeWidth="2.5" />
      {sessions.map((s, i) => (
        <g key={s.id}>
          <circle cx={x(i)} cy={y(s.bestLap)} r="4" fill="var(--purple)" />
          <circle cx={x(i)} cy={y(s.idealTime)} r="3" fill="var(--good)" />
          <text x={x(i)} y={h - 6} fontSize="10" textAnchor="middle" fill="var(--text-3)">
            {fmtDate(s.dateMs, { day: 'numeric', month: 'short' })}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function ProgressTab({ trackId, current, onOpen }: Props) {
  const [all, setAll] = useState<SessionSummary[] | null>(null);
  useEffect(() => {
    listSessions(trackId).then(setAll);
  }, [trackId, current]);
  if (!all) return null;
  const sorted = [...all].sort((a, b) => a.dateMs - b.dateMs);
  const idx = sorted.findIndex((s) => s.id === current.id);
  const prev = idx > 0 ? sorted[idx - 1] : null;

  return (
    <div className="panel-body">
      {prev ? (
        <div className="card">
          <div className="card-head">
            <h3>Since last session</h3>
            <span className="dim" style={{ fontSize: 12 }}>
              {fmtDate(prev.dateMs)}
            </span>
          </div>
          <div className="stats" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
            {(['bestLap', 'idealTime'] as const).map((k) => {
              const d = current[k] - prev[k];
              return (
                <div className="stat" key={k}>
                  <div className="l">{k === 'bestLap' ? 'Best lap' : 'Ideal lap'}</div>
                  <div className="v">{fmtLap(current[k])}</div>
                  <div className={`num ${d < 0 ? 'delta-good' : 'delta-bad'}`}>
                    {d < 0 ? '−' : '+'}
                    {Math.abs(d).toFixed(2)}s
                  </div>
                </div>
              );
            })}
          </div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Last session's focus corners
          </div>
          {prev.focus.map((id) => {
            const before = prev.corners.find((c) => c.id === id);
            const now = current.corners.find((c) => c.id === id);
            if (!before || !now) return null;
            const better = now.meanLoss < before.meanLoss - 0.05;
            const hit = Math.abs(now.meanMin - before.targetMin) <= 2.5;
            return (
              <div className="progress-row" key={id}>
                <span className={`check ${better ? 'ok' : 'no'}`}>{better ? <IconCheck width={13} height={13} /> : <IconWarn width={13} height={13} />}</span>
                <b className="num" style={{ width: 28 }}>
                  {id}
                </b>
                <span style={{ flex: 1 }}>
                  Avg loss {before.meanLoss.toFixed(2)} → <b>{now.meanLoss.toFixed(2)}s</b>
                  <span className="dim" style={{ display: 'block', fontSize: 12.5 }}>
                    Target {Math.round(before.targetMin)} km/h · you averaged {Math.round(now.meanMin)} {hit ? '✓' : ''}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <h3 style={{ marginBottom: 6 }}>Track your progress</h3>
          <p className="muted" style={{ fontSize: 14 }}>
            This is your first {sorted.length > 1 ? 'session in this run' : 'session'} at this track. Upload your next session and you'll see whether you hit
            this session's target speeds and how much time you found in each focus corner.
          </p>
        </div>
      )}

      {sorted.length > 1 && (
        <div className="card">
          <div className="card-head">
            <h3>Lap time trend</h3>
            <span style={{ fontSize: 12, display: 'flex', gap: 10 }}>
              <span style={{ color: 'var(--purple)' }}>● Best</span>
              <span style={{ color: 'var(--good)' }}>● Ideal</span>
            </span>
          </div>
          <TrendChart sessions={sorted} />
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>All sessions</h3>
        </div>
        {[...sorted].reverse().map((s) => (
          <button
            key={s.id}
            className="progress-row"
            style={{ width: '100%', textAlign: 'left', background: s.id === current.id ? 'var(--accent-soft)' : undefined, borderRadius: 8, padding: '9px 8px' }}
            onClick={() => s.id !== current.id && onOpen(s.id)}
          >
            <span style={{ flex: 1 }}>{fmtDate(s.dateMs)}</span>
            <span className="num" style={{ color: 'var(--purple)', fontSize: 17 }}>
              {fmtLap(s.bestLap)}
            </span>
            <span className="dim num" style={{ width: 64, textAlign: 'right' }}>
              {fmtLap(s.idealTime)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
