import { useEffect, useRef, useState } from 'react';
import { analyze, ParseError } from '../lib/analyze';
import { coachSession, fmtLap } from '../lib/coach';
import { deleteSession, listSessions, saveSession, sessionId, summarize, type SessionSummary } from '../lib/store';
import type { LatLon, TrackDef } from '../lib/types';
import { TRACKS } from '../tracks';
import { BrandMark, IconTrash, IconUpload } from './Icons';

function TrackThumb({ outline, size = 120 }: { outline: LatLon[]; size?: number }) {
  if (!outline.length)
    return (
      <svg width={size} height={size * 0.75} viewBox="0 0 100 75">
        <rect x="20" y="18" width="60" height="40" rx="20" fill="none" stroke="var(--line-2)" strokeWidth="4" strokeDasharray="6 6" />
      </svg>
    );
  const k = Math.cos((outline[0][0] * Math.PI) / 180);
  const xs = outline.map((p) => p[1] * k);
  const ys = outline.map((p) => -p[0]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min(90 / (x1 - x0), 65 / (y1 - y0));
  const ox = (100 - (x1 - x0) * s) / 2;
  const oy = (75 - (y1 - y0) * s) / 2;
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${(ox + (x - x0) * s).toFixed(1)},${(oy + (ys[i] - y0) * s).toFixed(1)}`).join('') + 'Z';
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 100 75">
      <path d={d} fill="none" stroke="var(--line-2)" strokeWidth="6" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx={ox + (xs[0] - x0) * s} cy={oy + (ys[0] - y0) * s} r="3.5" fill="var(--text)" />
    </svg>
  );
}

interface Props {
  onOpen: (id: string) => void;
  themeToggle: React.ReactNode;
}

export default function Home({ onOpen, themeToggle }: Props) {
  const [track, setTrack] = useState<TrackDef>(TRACKS[0]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = () => listSessions(track.id).then(setSessions);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id]);

  async function ingest(text: string, fileName: string) {
    setError(null);
    setBusy(true);
    try {
      // Let the spinner paint before the (synchronous) analysis runs.
      await new Promise((r) => setTimeout(r, 30));
      const a = analyze(text, track);
      const c = coachSession(a);
      const id = await sessionId(track.id, text);
      await saveSession(summarize(id, fileName, a, c), text);
      onOpen(id);
    } catch (e) {
      setError(e instanceof ParseError ? e.message : `Couldn't read that file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) return setError('Please choose a .csv file.');
    ingest(await f.text(), f.name);
  }

  async function trySample() {
    setBusy(true);
    const res = await fetch(`${import.meta.env.BASE_URL}samples/winton-sample.csv`);
    ingest(await res.text(), 'winton-sample.csv');
  }

  const sorted = [...sessions].sort((a, b) => a.dateMs - b.dateMs);
  const deltaFor = (s: SessionSummary) => {
    const i = sorted.findIndex((x) => x.id === s.id);
    return i > 0 ? s.bestLap - sorted[i - 1].bestLap : null;
  };

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          TrackDoctor
        </div>
        <span className="spacer" />
        {themeToggle}
      </header>
      <main className="home">
        <section className="hero">
          <h1>
            Find the time
            <br />
            <em>you already have.</em>
          </h1>
          <p>Upload your lap data and get coached corner by corner — where you lose time, why, and exactly what to do next session.</p>
        </section>

        <div className="step-title">
          <span className="n">1</span>
          <h2>Choose your track</h2>
        </div>
        <div className="track-grid">
          {TRACKS.map((t) => (
            <button
              key={t.id}
              className={`track-card ${t.id === track.id ? 'selected' : ''}`}
              disabled={!t.available}
              onClick={() => setTrack(t)}
            >
              <div className="thumb">
                <TrackThumb outline={t.outline} />
              </div>
              <div>
                <h3>{t.name}</h3>
                <div className="meta">
                  {t.available ? `${(t.lengthM / 1000).toFixed(2)} km · ${t.corners.length} corners` : t.location}
                </div>
              </div>
              {!t.available && <span className="tag">Soon</span>}
            </button>
          ))}
        </div>

        <div className="step-title">
          <span className="n">2</span>
          <h2>Upload a session</h2>
        </div>
        <div
          className={`dropzone ${over ? 'over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            onFile(e.dataTransfer.files[0]);
          }}
        >
          {busy ? (
            <>
              <div className="spinner" />
              <h3>Analysing your laps…</h3>
            </>
          ) : (
            <>
              <div className="icon">
                <IconUpload width={26} height={26} />
              </div>
              <h3>Drop your {track.name} CSV here</h3>
              <p className="muted" style={{ fontSize: 14 }}>
                RaceChrono CSV exports work best. Any CSV with time, latitude, longitude and speed also works.
              </p>
              <div className="actions">
                <button className="btn primary" onClick={() => input.current?.click()}>
                  <IconUpload width={18} height={18} /> Choose file
                </button>
                <button className="btn" onClick={trySample}>
                  Try a sample session
                </button>
              </div>
            </>
          )}
          <input ref={input} type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {error && <div className="error-box">{error}</div>}
        <details className="howto">
          <summary>How do I export from RaceChrono?</summary>
          <ol>
            <li>Open the session in RaceChrono and tap the menu (⋮).</li>
            <li>
              Choose <b>Export</b> → <b>CSV (v3)</b>, and include GPS channels.
            </li>
            <li>Save or share the file to your phone, then upload it here.</li>
          </ol>
        </details>

        <div className="step-title">
          <span className="n">3</span>
          <h2>Your {track.name} sessions</h2>
        </div>
        {sessions.length ? (
          <div className="session-list">
            {sessions.map((s) => {
              const d = new Date(s.dateMs);
              const delta = deltaFor(s);
              return (
                <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <button className="session-row" onClick={() => onOpen(s.id)}>
                    <div className="date">
                      <div className="d">{d.getDate()}</div>
                      <div className="m">{d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</div>
                    </div>
                    <div className="main">
                      <div className="num best" style={{ color: 'var(--purple)' }}>
                        {fmtLap(s.bestLap)}
                        {delta !== null && (
                          <span className={delta < 0 ? 'delta-good' : 'delta-bad'} style={{ fontSize: 16, marginLeft: 8 }}>
                            {delta < 0 ? '−' : '+'}
                            {Math.abs(delta).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="sub">
                        Ideal {fmtLap(s.idealTime)} · {s.lapCount} laps · focus {s.focus.join(', ')}
                      </div>
                    </div>
                  </button>
                  <button
                    className="icon-btn"
                    style={{ height: 'auto', width: 44, border: '1px solid var(--line)', borderRadius: 14 }}
                    aria-label="Delete session"
                    onClick={async () => {
                      if (!confirm('Delete this session from this device?')) return;
                      await deleteSession(s.id);
                      refresh();
                    }}
                  >
                    <IconTrash width={18} height={18} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty">No sessions yet. Upload one above — it stays on this device.</div>
        )}
      </main>
    </>
  );
}
