import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { CornerCoaching } from '../lib/coach';
import type { LapTrace, TrackDef } from '../lib/types';
import { deltaColor, severityOf, speedColor } from '../lib/ui';

export type ColorMode = 'speed' | 'delta';
export type BaseLayer = 'sat' | 'dark';

interface Props {
  track: TrackDef;
  lap: LapTrace;
  cmp: LapTrace | null;
  step: number;
  mode: ColorMode;
  base: BaseLayer;
  vRange: [number, number];
  coaching: CornerCoaching[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  scrubIdx: number | null;
  /** Bumped when the container resizes so Leaflet can re-measure. */
  sizeKey: string;
}

const TILES: Record<BaseLayer, { url: string; attribution: string; maxNativeZoom: number }> = {
  sat: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri',
    maxNativeZoom: 18,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxNativeZoom: 19,
  },
};

const ll = (lap: LapTrace, i: number): L.LatLngExpression => [lap.lat[i], lap.lon[i]];

/** A dot on the exact spot plus an offset label, so your markers and the reference lap's don't collide. */
function label(html: string, color: string, ghost = false): L.DivIcon {
  const pos = ghost ? 'pos-tl' : 'pos-br';
  const dot = ghost ? 'border:2px dashed #8fd3ff;background:rgba(17,20,24,.8)' : `background:${color}`;
  const box = ghost ? '' : `background:${color};color:${color === '#ff4d5e' ? '#fff' : '#111'}`;
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<div class="mk-dot" style="${dot}"></div><div class="mk-label ${pos} ${ghost ? 'ghost' : ''}" style="${box}">${html}</div>`,
  });
}

export default function MapView(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const lineLayer = useRef(L.layerGroup());
  const pinLayer = useRef(L.layerGroup());
  const detailLayer = useRef(L.layerGroup());
  const scrub = useRef<L.Marker | null>(null);
  const renderer = useRef(L.canvas({ padding: 0.5 }));
  const onSelect = useRef(p.onSelect);
  onSelect.current = p.onSelect;
  const selectedRef = useRef(p.selected);
  selectedRef.current = p.selected;

  const trackBounds = () => L.latLngBounds(Array.from(p.lap.lat, (la, i) => [la, p.lap.lon[i]] as [number, number]));
  const pad = (): L.FitBoundsOptions => {
    const w = el.current?.clientWidth ?? 800;
    const s = w < 600 ? 24 : 48;
    return { paddingTopLeft: [s, s + (w < 600 ? 56 : 40)], paddingBottomRight: [s, s + (w < 600 ? 20 : 30)] };
  };

  // Init
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
      zoomSnap: 0.25,
      maxZoom: 20,
    });
    m.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    lineLayer.current.addTo(m);
    detailLayer.current.addTo(m);
    pinLayer.current.addTo(m);
    m.fitBounds(trackBounds(), pad());
    map.current = m;
    let lastW = el.current.clientWidth;
    const ro = new ResizeObserver(() => {
      m.invalidateSize();
      const w = el.current?.clientWidth ?? lastW;
      if (Math.abs(w - lastW) > 40 && !selectedRef.current) m.fitBounds(trackBounds(), pad());
      lastW = w;
    });
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Base tiles
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    tiles.current?.remove();
    const t = TILES[p.base];
    tiles.current = L.tileLayer(t.url, { attribution: t.attribution, maxNativeZoom: t.maxNativeZoom, maxZoom: 20 }).addTo(m);
    tiles.current.bringToBack();
  }, [p.base]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    // Wait for the CSS height transition before re-measuring.
    const t = setTimeout(() => {
      m.invalidateSize();
      if (!selectedRef.current) m.fitBounds(trackBounds(), pad());
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.sizeKey]);

  const sel = p.coaching.find((c) => c.corner.def.id === p.selected) ?? null;

  // Racing line
  useEffect(() => {
    const g = lineLayer.current;
    g.clearLayers();
    const { lap, cmp, step } = p;
    const n = lap.v.length;
    const coords = Array.from({ length: n }, (_, i) => ll(lap, i));
    const r = renderer.current;
    L.polyline(coords, { weight: 10, color: '#000', opacity: 0.55, renderer: r, interactive: false }).addTo(g);
    const lo = sel ? Math.round(sel.corner.sectionStart / step) : 0;
    const hi = sel ? Math.round(sel.corner.sectionEnd / step) : n - 1;
    const k = 3;
    for (let i = 0; i < n - 1; i += 2) {
      const j = Math.min(n - 1, i + 2);
      let color: string;
      if (p.mode === 'delta' && cmp) {
        const a = Math.max(0, i - k);
        const b = Math.min(n - 1, i + k);
        const rate = (lap.t[b] - lap.t[a] - (cmp.t[b] - cmp.t[a])) / ((b - a) * step);
        color = deltaColor(rate);
      } else color = speedColor(lap.v[i], p.vRange[0], p.vRange[1]);
      const inSel = !sel || (i >= lo && i <= hi);
      L.polyline([coords[i], coords[j]], {
        weight: inSel ? 6 : 4,
        color,
        opacity: inSel ? 1 : 0.35,
        renderer: r,
        interactive: false,
        lineCap: 'round',
      }).addTo(g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.lap, p.cmp, p.mode, p.vRange, p.selected]);

  // Corner pins
  useEffect(() => {
    const g = pinLayer.current;
    g.clearLayers();
    const compact = (el.current?.clientWidth ?? 800) < 500;
    for (const c of p.coaching) {
      const k = c.corner;
      const cl = k.laps.find((l) => l.lap === p.lap.lap);
      const loss = cl?.loss ?? k.meanLoss;
      const sev = severityOf(loss);
      const active = p.selected === k.def.id;
      // The open corner's own markers (brake, slowest point) take its place.
      if (active) continue;
      const faded = !!p.selected;
      const i = Math.round(k.apexS / p.step);
      const lossTxt = cl ? (loss < 0.005 ? 'BEST' : `+${loss.toFixed(2)}s`) : `${k.meanLoss.toFixed(2)}s`;
      const html = `<div class="pin sev-${sev} ${active ? 'active' : ''} ${faded ? 'faded' : ''}">
        <div class="bubble ${compact ? 'compact' : ''}"><span class="id">${k.def.id.replace('T', '')}</span>${compact ? '' : `<span class="loss">${lossTxt}</span>`}</div>
        <div class="stem"></div></div>`;
      const mk = L.marker(ll(p.lap, Math.min(i, p.lap.lat.length - 1)), {
        icon: L.divIcon({ className: '', iconSize: [0, 0], html }),
        zIndexOffset: active ? 1000 : Math.round(loss * 100),
        keyboard: true,
        title: `${k.def.name}: ${c.headline}`,
      });
      mk.on('click', () => onSelect.current(active ? null : k.def.id));
      mk.addTo(g);
    }
  }, [p.coaching, p.lap, p.selected, p.step, p.sizeKey]);

  // Selected corner: braking / apex / throttle markers and camera
  useEffect(() => {
    const g = detailLayer.current;
    g.clearLayers();
    const m = map.current;
    if (!m) return;
    if (!sel) {
      m.flyToBounds(trackBounds(), { ...pad(), duration: 0.6 });
      return;
    }
    const k = sel.corner;
    const mine = k.laps.find((l) => l.lap === p.lap.lap);
    const ref = k.best;
    const idx = (s: number) => Math.min(p.lap.lat.length - 1, Math.round(s / p.step));
    if (p.cmp && ref.lap !== p.lap.lap) {
      const lo = idx(k.sectionStart);
      const hi = idx(k.sectionEnd);
      const pts = [];
      for (let i = lo; i <= hi; i++) pts.push(ll(p.cmp, i));
      L.polyline(pts, { color: '#8fd3ff', weight: 2.5, dashArray: '6 6', opacity: 0.9, interactive: false }).addTo(g);
    }
    if (mine) {
      if (ref.lap !== mine.lap) {
        if (p.cmp) {
          L.marker(ll(p.cmp, idx(ref.brakeAt)), { icon: label(`<small>L${ref.lap}</small> brake`, '', true), interactive: false }).addTo(g);
          L.marker(ll(p.cmp, idx(ref.minAt)), { icon: label(`<small>L${ref.lap}</small> ${Math.round(ref.minSpeed)}`, '', true), interactive: false }).addTo(g);
        }
      }
      L.marker(ll(p.lap, idx(mine.brakeAt)), { icon: label('Brake', '#ff4d5e'), interactive: false }).addTo(g);
      L.marker(ll(p.lap, idx(mine.minAt)), {
        icon: label(`${Math.round(mine.minSpeed)} <small>km/h</small>`, '#ffffff'),
        interactive: false,
        zIndexOffset: 500,
      }).addTo(g);
      if (mine.throttleAt - mine.minAt >= 40)
        L.marker(ll(p.lap, idx(mine.throttleAt)), { icon: label('Throttle', '#2fd17c'), interactive: false }).addTo(g);
    }
    const b = L.latLngBounds([]);
    for (let s = Math.max(0, Math.min(k.sectionStart, (mine?.brakeAt ?? k.sectionStart) - 30)); s <= k.sectionEnd; s += p.step * 5)
      b.extend(ll(p.lap, idx(s)));
    m.flyToBounds(b, { ...pad(), duration: 0.6, maxZoom: 18 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.selected, p.lap, p.cmp]);

  // Scrub marker
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (p.scrubIdx === null) {
      scrub.current?.remove();
      scrub.current = null;
      return;
    }
    const pos = ll(p.lap, Math.min(p.scrubIdx, p.lap.lat.length - 1));
    if (!scrub.current)
      scrub.current = L.marker(pos, {
        icon: L.divIcon({ className: '', iconSize: [0, 0], html: '<div class="scrub-dot"></div>' }),
        interactive: false,
        zIndexOffset: 2000,
      }).addTo(m);
    else scrub.current.setLatLng(pos);
  }, [p.scrubIdx, p.lap]);

  return <div ref={el} className="map" />;
}
