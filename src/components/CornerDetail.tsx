import type { ReactNode } from 'react';
import type { CornerCoaching } from '../lib/coach';
import { DIAG_COLOR, fmtLoss, severityOf } from '../lib/ui';
import { IconBack, IconNext } from './Icons';

interface Props {
  cc: CornerCoaching;
  lapNo: number;
  onSelectLap: (n: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  chart: ReactNode;
  brakeErrorM: number | null;
}

const KIND: Record<string, string> = {
  hairpin: 'Hairpin',
  fast: 'Fast corner',
  sweeper: 'Sweeper',
  'heavy-brake': 'Heavy braking',
  complex: 'Complex',
};

export default function CornerDetail({ cc, lapNo, onSelectLap, onPrev, onNext, onBack, chart, brakeErrorM }: Props) {
  const k = cc.corner;
  const mine = k.laps.find((l) => l.lap === lapNo);
  const verdict = mine ? cc.verdicts.get(mine.lap)! : null;
  const mins = k.laps.map((l) => l.minSpeed);
  const lo = Math.floor(Math.min(...mins, cc.target.lo) - 4);
  const hi = Math.ceil(Math.max(...mins, cc.target.hi) + 4);
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const sev = severityOf(k.medianLoss);

  return (
    <div className="panel-body">
      <div className="corner-nav">
        <button className="btn small ghost" onClick={onBack} style={{ flex: 'none' }}>
          <IconBack width={16} height={16} /> All corners
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn small" onClick={onPrev} aria-label="Previous corner" style={{ flex: 'none', width: 40, padding: 0 }}>
          <IconBack width={16} height={16} />
        </button>
        <button className="btn small" onClick={onNext} aria-label="Next corner" style={{ flex: 'none', width: 40, padding: 0 }}>
          <IconNext width={16} height={16} />
        </button>
      </div>

      <div className={`corner-head sev-${sev}`}>
        <span className="id">{k.def.id}</span>
        <div className="name">
          <div className="n">
            {k.def.direction === 'L' ? 'Left' : 'Right'} · {KIND[k.def.kind]}
          </div>
          <div className="b">{k.def.blurb}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="gain">{k.medianLoss.toFixed(2)}s</div>
          <div className="eyebrow" style={{ fontSize: 9.5 }}>
            typical loss / lap
          </div>
        </div>
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 4 }}>
          The fix
        </div>
        <div className="headline">{cc.headline}</div>
        <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
          Your best here was <b>Lap {k.best.lap}</b>: {Math.round(k.best.minSpeed)} km/h at the slowest point,{' '}
          {Math.round(k.best.exitSpeed)} km/h 100 m later.
        </p>
        <div className="target" style={{ marginTop: 16 }}>
          <div className="gauge">
            <div className="track">
              <div className="zone" style={{ left: pos(cc.target.lo), width: `calc(${pos(cc.target.hi)} - ${pos(cc.target.lo)})` }} />
              {k.laps.map((l) => (
                <button
                  key={l.lap}
                  className={`dot ${l.lap === lapNo ? 'me' : ''}`}
                  style={{ left: pos(l.minSpeed) }}
                  title={`Lap ${l.lap}: ${l.minSpeed.toFixed(0)} km/h`}
                  onClick={() => onSelectLap(l.lap)}
                />
              ))}
            </div>
            <div className="scale">
              <span>{lo}</span>
              <span style={{ color: 'var(--good)', fontWeight: 600 }}>
                Target {cc.target.lo}–{cc.target.hi} km/h
              </span>
              <span>{hi}</span>
            </div>
          </div>
        </div>
        <p className="dim" style={{ fontSize: 12, marginTop: 6 }}>
          Slowest-point speed on each lap. Spread: {k.minSpeedSpread.toFixed(0)} km/h.
        </p>
      </div>

      {cc.oneOff && (
        <div className="card note">
          <span>{cc.oneOff}</span>
        </div>
      )}

      {verdict && mine && (
        <div className="verdict" style={{ ['--vc' as string]: DIAG_COLOR[verdict.diagnosis] }}>
          <div className="eyebrow" style={{ marginBottom: 2 }}>
            Lap {mine.lap} here
          </div>
          <div className="vt">{verdict.title}</div>
          <div className="vd">{verdict.detail}</div>
        </div>
      )}

      {chart}

      <div className="card">
        <div className="card-head">
          <h3>What to do</h3>
          {cc.pattern && <span className="tag">{cc.pattern.split(':')[0]}</span>}
        </div>
        <ul className="dos">
          {cc.dos.map((d, i) => (
            <li key={i}>
              <span className="bullet">{i + 1}</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
        {brakeErrorM && (
          <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>
            Braking markers on the map are ±{brakeErrorM} m (1 Hz GPS) — use them as earlier/later hints.
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Lap by lap</h3>
          <span className="dim" style={{ fontSize: 12 }}>
            tap a row to view it
          </span>
        </div>
        <table className="mini-table">
          <thead>
            <tr>
              <th>Lap</th>
              <th>Time</th>
              <th>Min</th>
              <th>Exit</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {k.laps.map((l) => {
              const v = cc.verdicts.get(l.lap)!;
              return (
                <tr key={l.lap} className={l.lap === lapNo ? 'sel' : ''} onClick={() => onSelectLap(l.lap)}>
                  <td className="num">L{l.lap}</td>
                  <td className="num" style={{ color: l.loss < 0.005 ? 'var(--purple)' : undefined }}>
                    {fmtLoss(l.loss)}
                  </td>
                  <td className="num">{Math.round(l.minSpeed)}</td>
                  <td className="num">{Math.round(l.exitSpeed)}</td>
                  <td>
                    <span className="vchip" style={{ ['--vc' as string]: DIAG_COLOR[v.diagnosis] }}>
                      {v.title}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
