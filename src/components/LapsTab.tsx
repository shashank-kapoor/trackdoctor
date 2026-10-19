import { fmtLap } from '../lib/coach';
import type { SessionAnalysis } from '../lib/types';

interface Props {
  a: SessionAnalysis;
  lapNo: number;
  onSelect: (lap: number, corner?: string) => void;
  onToggleLap: (lap: number, include: boolean) => void;
}

const KIND_LABEL = { out: 'Out lap', warmup: 'Warm-up', slow: 'Slow', flying: '' } as const;

export default function LapsTab({ a, lapNo, onSelect, onToggleLap }: Props) {
  const maxLoss = Math.max(0.3, ...a.corners.flatMap((c) => c.laps.map((l) => l.loss)));
  const valid = a.laps.filter((l) => a.validLaps.includes(l.lap));
  const bestTime = Math.min(...valid.map((l) => l.time));
  return (
    <div className="panel-body">
      <div className="card">
        <div className="card-head">
          <h3>Laps</h3>
          <span className="dim" style={{ fontSize: 12 }}>
            switch off laps with traffic or spins
          </span>
        </div>
        {a.laps.map((l) => {
          const on = a.validLaps.includes(l.lap);
          return (
            <div className="lap-row" key={l.lap}>
              <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onToggleLap(l.lap, !on)} aria-label={`Use lap ${l.lap}`} />
              <button style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, textAlign: 'left' }} onClick={() => on && onSelect(l.lap)}>
                <span className="dim num" style={{ width: 26 }}>
                  L{l.lap}
                </span>
                <span className="num lt" style={{ color: on && l.time === bestTime ? 'var(--purple)' : on ? undefined : 'var(--text-3)' }}>
                  {fmtLap(l.time)}
                </span>
                <span className="dim" style={{ fontSize: 13 }}>
                  {on && l.time !== bestTime ? `+${(l.time - bestTime).toFixed(2)}` : ''}
                </span>
                <span style={{ flex: 1 }} />
                {KIND_LABEL[l.kind] && <span className="tag">{KIND_LABEL[l.kind]}</span>}
                {l.lap === lapNo && <span className="tag" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Viewing</span>}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="card-head">
          <h3>Time lost by corner</h3>
        </div>
        <p className="dim" style={{ fontSize: 13, marginBottom: 8 }}>
          Seconds behind your best run through each corner. <span style={{ color: 'var(--purple)' }}>Purple</span> = your best.
        </p>
        <table className="heat">
          <thead>
            <tr>
              <th />
              {a.corners.map((c) => (
                <th key={c.def.id}>{c.def.id}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {valid.map((l) => (
              <tr key={l.lap}>
                <td className="lapcell num" style={{ color: l.lap === lapNo ? 'var(--accent)' : undefined }}>
                  L{l.lap}
                </td>
                {a.corners.map((c) => {
                  const cl = c.laps.find((x) => x.lap === l.lap)!;
                  const best = cl.loss < 0.005;
                  const f = Math.min(1, cl.loss / maxLoss);
                  return (
                    <td
                      key={c.def.id}
                      className={best ? 'bestcell' : ''}
                      style={best ? undefined : { background: `rgba(255, 77, 94, ${0.06 + f * 0.6})` }}
                      onClick={() => onSelect(l.lap, c.def.id)}
                    >
                      {best ? '★' : cl.loss.toFixed(1)}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="lapcell dim">Avg</td>
              {a.corners.map((c) => (
                <td key={c.def.id} className="num" style={{ fontWeight: 700, cursor: 'default' }}>
                  {c.meanLoss.toFixed(1)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
