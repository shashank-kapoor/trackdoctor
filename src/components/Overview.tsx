import type { ReactNode } from 'react';
import type { CornerCoaching, SessionCoaching } from '../lib/coach';
import { fmtLap } from '../lib/coach';
import type { SessionAnalysis } from '../lib/types';
import { severityOf } from '../lib/ui';
import { IconTarget, IconWarn } from './Icons';

interface Props {
  a: SessionAnalysis;
  coach: SessionCoaching;
  lapNo: number;
  onSelectCorner: (id: string) => void;
  chart: ReactNode;
}

function CornerCard({ cc, lapNo, onClick }: { cc: CornerCoaching; lapNo: number; onClick: () => void }) {
  const k = cc.corner;
  const loss = k.laps.find((l) => l.lap === lapNo)?.loss ?? k.meanLoss;
  const sev = severityOf(k.meanLoss);
  return (
    <button className={`focus-item sev-${sev}`} onClick={onClick}>
      <span className="corner-chip">{k.def.id}</span>
      <div className="body">
        <div className="t">{cc.headline}</div>
        <div className="s">
          avg {k.meanLoss.toFixed(2)}s · this lap {loss < 0.005 ? 'best' : `+${loss.toFixed(2)}s`}
        </div>
      </div>
    </button>
  );
}

export default function Overview({ a, coach, lapNo, onSelectCorner, chart }: Props) {
  const best = a.laps.find((l) => l.lap === a.bestLap)!;
  const gain = best.time - a.idealTime;
  return (
    <div className="panel-body">
      <div className="stats">
        <div className="stat purple">
          <div className="l">Best lap</div>
          <div className="v">{fmtLap(best.time)}</div>
        </div>
        <div className="stat">
          <div className="l">Ideal lap</div>
          <div className="v">{fmtLap(a.idealTime)}</div>
        </div>
        <div className="stat accent">
          <div className="l">On the table</div>
          <div className="v">−{gain.toFixed(1)}s</div>
        </div>
      </div>
      <p className="dim" style={{ fontSize: 13, marginTop: -6 }}>
        Your ideal lap stitches together your best run through every corner. You've already driven every piece of it — the gain comes from
        doing your best version every lap.
      </p>

      {coach.keyFinding && (
        <div className="card finding">
          <div className="eyebrow" style={{ marginBottom: 6, color: 'var(--accent)' }}>
            Key finding
          </div>
          <p>{coach.keyFinding}</p>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>Focus next session</h3>
          <span className="tag">Top 3</span>
        </div>
        {coach.focus.map((f, i) => (
          <button key={f.corner.def.id} className={`focus-item sev-${f.severity}`} onClick={() => onSelectCorner(f.corner.def.id)}>
            <span className="rank">{i + 1}</span>
            <div className="body">
              <div className="t">
                {f.corner.def.id} · {f.headline}
              </div>
              <div className="s">{f.pattern ?? f.corner.def.blurb}</div>
            </div>
            <span className="gain">{f.corner.meanLoss.toFixed(2)}s</span>
          </button>
        ))}
      </div>

      {chart}

      <div className="card">
        <div className="card-head">
          <h3>Target speeds</h3>
          <IconTarget width={18} height={18} style={{ color: 'var(--good)' }} />
        </div>
        <p className="dim" style={{ fontSize: 13, marginBottom: 10 }}>
          Hit these at the slowest point of each corner instead of chasing later braking. Each is your own best.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
          {coach.corners.map((c) => (
            <button
              key={c.corner.def.id}
              className="stat"
              style={{ textAlign: 'left', cursor: 'pointer' }}
              onClick={() => onSelectCorner(c.corner.def.id)}
            >
              <div className="l">{c.corner.def.id}</div>
              <div className="v" style={{ fontSize: 22 }}>
                {c.target.min}
                <span className="dim" style={{ fontSize: 12, marginLeft: 3 }}>
                  km/h
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Every corner</h3>
          <span className="dim" style={{ fontSize: 12 }}>
            tap for coaching
          </span>
        </div>
        <div>
          {coach.corners.map((cc) => (
            <div key={cc.corner.def.id} style={{ marginTop: 8 }}>
              <CornerCard cc={cc} lapNo={lapNo} onClick={() => onSelectCorner(cc.corner.def.id)} />
            </div>
          ))}
        </div>
      </div>

      {coach.dataQuality.note && (
        <div className="card note">
          <IconWarn width={18} height={18} />
          <span>{coach.dataQuality.note}</span>
        </div>
      )}
    </div>
  );
}
