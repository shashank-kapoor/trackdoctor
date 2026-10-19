import { useEffect, useMemo, useState } from 'react';
import { analyzeParsed } from '../lib/analyze';
import { coachSession, fmtLap } from '../lib/coach';
import { parseCsv } from '../lib/parse';
import { loadCsv, loadSummary, saveSession, summarize, type SessionSummary } from '../lib/store';
import type { ParsedSession, TrackDef } from '../lib/types';
import { SPEED_GRADIENT, fmtDate, useMedia } from '../lib/ui';
import { trackById } from '../tracks';
import CornerDetail from './CornerDetail';
import { IconBack, IconExpand, IconShrink } from './Icons';
import LapsTab from './LapsTab';
import MapView, { type BaseLayer, type ColorMode } from './MapView';
import Overview from './Overview';
import ProgressTab from './ProgressTab';
import SpeedChart from './SpeedChart';

interface Props {
  id: string;
  onBack: () => void;
  onOpen: (id: string) => void;
  themeToggle: React.ReactNode;
}

type Tab = 'coach' | 'laps' | 'progress';

export default function SessionView({ id, onBack, onOpen, themeToggle }: Props) {
  const [loaded, setLoaded] = useState<{ parsed: ParsedSession; track: TrackDef; summary: SessionSummary } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(null);
    (async () => {
      const [csv, summary] = await Promise.all([loadCsv(id), loadSummary(id)]);
      const track = summary && trackById(summary.trackId);
      if (!csv || !summary || !track) return setError("This session isn't on this device any more.");
      setLoaded({ parsed: parseCsv(csv), track, summary });
    })().catch((e) => setError(String(e?.message ?? e)));
  }, [id]);

  if (error)
    return (
      <div className="loading">
        <div style={{ textAlign: 'center' }}>
          <p>{error}</p>
          <button className="btn" style={{ marginTop: 12 }} onClick={onBack}>
            Back to sessions
          </button>
        </div>
      </div>
    );
  if (!loaded)
    return (
      <div className="loading">
        <div>
          <div className="spinner" />
          Analysing session…
        </div>
      </div>
    );
  return <Loaded key={id} {...loaded} onBack={onBack} onOpen={onOpen} themeToggle={themeToggle} />;
}

function Loaded({
  parsed,
  track,
  summary: initial,
  onBack,
  onOpen,
  themeToggle,
}: {
  parsed: ParsedSession;
  track: TrackDef;
  summary: SessionSummary;
  onBack: () => void;
  onOpen: (id: string) => void;
  themeToggle: React.ReactNode;
}) {
  const [exclude, setExclude] = useState<number[]>(initial.exclude ?? []);
  const [include, setInclude] = useState<number[]>(initial.include ?? []);
  const a = useMemo(
    () => analyzeParsed(parsed, track, { exclude, include, dateMs: initial.dateMs }),
    [parsed, track, exclude, include, initial.dateMs],
  );
  const coach = useMemo(() => coachSession(a), [a]);
  const summary = useMemo(() => summarize(initial.id, initial.fileName, a, coach, { addedMs: initial.addedMs, include }), [a, coach, initial, include]);
  useEffect(() => {
    saveSession(summary);
  }, [summary]);

  const isMobile = useMedia('(max-width: 820px)');
  const [lapNo, setLapNo] = useState(a.bestLap);
  const [cmpChoice, setCmpChoice] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('coach');
  const [mode, setMode] = useState<ColorMode>('speed');
  const [base, setBase] = useState<BaseLayer>('sat');
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const [bigMap, setBigMap] = useState(false);

  const valid = a.laps.filter((l) => a.validLaps.includes(l.lap));
  const lap = valid.find((l) => l.lap === lapNo) ?? valid.find((l) => l.lap === a.bestLap)!;
  const sel = coach.corners.find((c) => c.corner.def.id === selected) ?? null;
  const ranked = [...valid].sort((x, y) => x.time - y.time);
  const fallbackCmp = (ranked[0].lap === lap.lap ? ranked[1] : ranked[0]) ?? null;
  const cmp = useMemo(() => {
    if (sel && sel.corner.best.lap !== lap.lap) return valid.find((l) => l.lap === sel.corner.best.lap) ?? null;
    if (!sel && cmpChoice !== null && cmpChoice !== lap.lap) return valid.find((l) => l.lap === cmpChoice) ?? null;
    return fallbackCmp && fallbackCmp.lap !== lap.lap ? fallbackCmp : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, lap, cmpChoice, a]);

  const vRange = useMemo<[number, number]>(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const l of valid)
      for (const v of l.v) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    return [lo, hi];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a]);

  const range: [number, number] = sel
    ? [Math.max(0, sel.corner.sectionStart - 40), Math.min(track.lengthM, sel.corner.sectionEnd + 40)]
    : [0, track.lengthM];

  const selectCorner = (id: string | null) => {
    setSelected(id);
    setScrubIdx(null);
    if (id) setTab('coach');
    document.querySelector('.panel')?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const stepCorner = (d: number) => {
    const ids = track.corners.map((c) => c.id);
    const i = ids.indexOf(selected ?? ids[0]);
    selectCorner(ids[(i + d + ids.length) % ids.length]);
  };
  const toggleLap = (n: number, on: boolean) => {
    const kind = a.laps.find((l) => l.lap === n)?.kind;
    if (on) {
      setExclude((x) => x.filter((v) => v !== n));
      if (kind !== 'flying') setInclude((x) => [...new Set([...x, n])]);
    } else {
      if (a.validLaps.length <= 1) return;
      setInclude((x) => x.filter((v) => v !== n));
      setExclude((x) => [...new Set([...x, n])]);
      if (n === lapNo) setLapNo(a.bestLap === n ? valid.find((l) => l.lap !== n)!.lap : a.bestLap);
    }
  };

  const chart = (
    <SpeedChart
      lap={lap}
      cmp={cmp}
      corners={a.corners}
      step={a.step}
      range={range}
      selected={selected}
      onSelectCorner={selectCorner}
      scrubIdx={scrubIdx}
      onScrub={setScrubIdx}
      height={isMobile ? 170 : 180}
    />
  );
  const panelChart = isMobile ? <div className="card" style={{ padding: '10px 10px 6px' }}>{chart}</div> : null;
  const bestTime = ranked[0].time;

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <IconBack />
        </button>
        <div className="session-head">
          <div className="title">
            <h1>{track.name}</h1>
            <div className="sub">
              {fmtDate(a.dateMs)} · {a.laps.length} laps · best {fmtLap(bestTime)}
            </div>
          </div>
        </div>
        <span className="spacer" />
        {themeToggle}
      </header>
      <div className={`session ${bigMap ? 'map-big' : ''}`}>
        <div className="map-wrap">
          <MapView
            track={track}
            lap={lap}
            cmp={cmp}
            step={a.step}
            mode={mode}
            base={base}
            vRange={vRange}
            coaching={coach.corners}
            selected={selected}
            onSelect={selectCorner}
            scrubIdx={scrubIdx}
            sizeKey={`${isMobile}-${bigMap}`}
          />
          <div className="map-controls">
            <div className="seg">
              <button className={mode === 'speed' ? 'on' : ''} onClick={() => setMode('speed')}>
                Speed
              </button>
              <button className={mode === 'delta' ? 'on' : ''} onClick={() => setMode('delta')} disabled={!cmp}>
                Gain / loss
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="seg">
                <button className={base === 'sat' ? 'on' : ''} onClick={() => setBase('sat')}>
                  Satellite
                </button>
                <button className={base === 'dark' ? 'on' : ''} onClick={() => setBase('dark')}>
                  Map
                </button>
              </div>
              <div className="seg show-sm">
                <button onClick={() => setBigMap((b) => !b)} aria-label={bigMap ? 'Shrink map' : 'Expand map'}>
                  {bigMap ? <IconShrink width={16} height={16} /> : <IconExpand width={16} height={16} />}
                </button>
              </div>
            </div>
          </div>
          <div className="legend">
            {mode === 'speed' || !cmp ? (
              <>
                <span>Lap {lap.lap} speed</span>
                <div className="bar" style={{ background: SPEED_GRADIENT }} />
                <div className="ends">
                  <span>{Math.round(vRange[0])}</span>
                  <span>{Math.round(vRange[1])} km/h</span>
                </div>
              </>
            ) : (
              <>
                <span>
                  Lap {lap.lap} vs Lap {cmp.lap}
                </span>
                <div className="keys">
                  <span className="key">
                    <span className="sw" style={{ background: '#28d678' }} /> Gaining
                  </span>
                  <span className="key">
                    <span className="sw" style={{ background: '#ff4054' }} /> Losing
                  </span>
                </div>
              </>
            )}
            {sel && (
              <div className="keys corner-keys" style={{ borderTop: '1px solid var(--line)', paddingTop: 5 }}>
                <span className="key">
                  <span className="sw" style={{ background: '#ff4d5e' }} /> Brake
                </span>
                <span className="key">
                  <span className="sw" style={{ background: '#fff' }} /> Slowest
                </span>
                <span className="key">
                  <span className="sw" style={{ background: '#2fd17c' }} /> Throttle
                </span>
                {cmp && (
                  <span className="key">
                    <span className="sw" style={{ border: '1.5px dashed var(--ref)' }} /> Lap {cmp.lap}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {!isMobile && <div className="chart-wrap">{chart}</div>}

        <aside className="panel">
          <div className="tabs">
            {(['coach', 'laps', 'progress'] as Tab[]).map((t) => (
              <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                {t === 'coach' ? 'Coach' : t === 'laps' ? 'Laps' : 'Progress'}
              </button>
            ))}
          </div>
          <div style={{ padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="eyebrow">Viewing lap</span>
              {!sel && cmp && (
                <label className="dim" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  compare with
                  <select
                    value={cmp.lap}
                    onChange={(e) => setCmpChoice(+e.target.value)}
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--line-2)', borderRadius: 7, padding: '3px 6px', font: 'inherit' }}
                  >
                    {valid
                      .filter((l) => l.lap !== lap.lap)
                      .map((l) => (
                        <option key={l.lap} value={l.lap}>
                          Lap {l.lap} · {fmtLap(l.time)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {sel && cmp && <span className="dim" style={{ fontSize: 12 }}>vs Lap {cmp.lap} (best here)</span>}
            </div>
            <div className="lap-strip">
              {valid.map((l) => (
                <button
                  key={l.lap}
                  className={`lap-chip ${l.time === bestTime ? 'best' : ''} ${l.lap === lap.lap ? 'on' : ''} ${cmp?.lap === l.lap ? 'cmp' : ''}`}
                  onClick={() => setLapNo(l.lap)}
                >
                  <span className="ln">Lap {l.lap}</span>
                  <span className="lt">{fmtLap(l.time)}</span>
                </button>
              ))}
            </div>
          </div>
          {tab === 'coach' &&
            (sel ? (
              <CornerDetail
                cc={sel}
                lapNo={lap.lap}
                onSelectLap={setLapNo}
                onPrev={() => stepCorner(-1)}
                onNext={() => stepCorner(1)}
                onBack={() => selectCorner(null)}
                chart={panelChart}
                brakeErrorM={coach.dataQuality.brakeErrorM}
              />
            ) : (
              <Overview a={a} coach={coach} lapNo={lap.lap} onSelectCorner={selectCorner} chart={panelChart} />
            ))}
          {tab === 'laps' && (
            <LapsTab
              a={a}
              lapNo={lap.lap}
              onToggleLap={toggleLap}
              onSelect={(n, c) => {
                setLapNo(n);
                if (c) selectCorner(c);
              }}
            />
          )}
          {tab === 'progress' && <ProgressTab trackId={track.id} current={summary} onOpen={onOpen} />}
        </aside>
      </div>
    </>
  );
}
