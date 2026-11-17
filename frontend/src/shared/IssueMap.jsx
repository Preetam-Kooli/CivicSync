import { useEffect, useMemo, useRef, useState } from 'react';
import { GLMap, NavigationControl, GeolocateControl, Popup } from './maplibre.js';
import { MAP_STYLES, DEFAULT_CENTER, MODULES } from './mapConfig.js';
import { STATUS_LABELS } from './issueUi.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const colorByModule = ['match', ['get', 'module'], ...MODULES.flatMap((m) => [m.id, m.color]), '#64748b'];

// Adds our data and layers. Runs again after every style switch, because
// switching the base style (light/dark) removes everything we added.
function addIssueLayers(map, data) {
  if (map.getSource('issues')) return;

  // "cluster: true" makes MapLibre group nearby points into numbered circles
  map.addSource('issues', { type: 'geojson', data, cluster: true, clusterMaxZoom: 15, clusterRadius: 45 });
  map.addSource('issues-heat', { type: 'geojson', data });

  map.addLayer({
    id: 'heat',
    type: 'heatmap',
    source: 'issues-heat',
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'severity'], 1, 0.3, 5, 1],
      'heatmap-radius': 30,
      'heatmap-opacity': 0.7,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0,0,0,0)', 0.3, '#fde68a', 0.6, '#f97316', 1, '#dc2626',
      ],
    },
  });
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'issues',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#60a5fa', 10, '#f59e0b', 30, '#ef4444'],
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 30, 28],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'issues',
    filter: ['has', 'point_count'],
    layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 13, 'text-font': ['Noto Sans Regular'] },
    paint: { 'text-color': '#ffffff' },
  });
  map.addLayer({
    id: 'points',
    type: 'circle',
    source: 'issues',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': colorByModule,
      'circle-radius': ['interpolate', ['linear'], ['get', 'severity'], 1, 6, 5, 11], // bigger = more severe
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });
}

// Popups are built from DOM nodes with textContent, never from HTML strings, so
// text typed by a citizen can never run as code (cross-site scripting).
function showPopup(map, feature, onOpenIssue) {
  const p = feature.properties;
  const box = document.createElement('div');
  box.style.cssText = 'font: 14px/1.4 system-ui, sans-serif; min-width: 170px';

  const title = document.createElement('strong');
  title.textContent = p.title;
  const meta = document.createElement('div');
  meta.textContent = `${p.category} · ${STATUS_LABELS[p.status] || p.status}`;
  box.append(title, meta);

  if (Number(p.duplicateCount) > 1) {
    const dup = document.createElement('div');
    dup.textContent = `Reported by ${p.duplicateCount} people`;
    box.append(dup);
  }
  if (onOpenIssue) {
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Open details';
    open.style.cssText = 'margin-top:8px;min-height:44px;width:100%;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-size:14px';
    open.onclick = () => onOpenIssue(p.id);
    box.append(open);
  }

  new Popup({ maxWidth: '260px', offset: 10 })
    .setLngLat(feature.geometry.coordinates)
    .setDOMContent(box)
    .addTo(map);
}

export default function IssueMap({ collection, onOpenIssue }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const dataRef = useRef(EMPTY);
  const fittedRef = useRef(false);
  const appliedStyleRef = useRef(MAP_STYLES.light);
  const heatRef = useRef(false);
  const onOpenRef = useRef(onOpenIssue);

  const [visibleModules, setVisibleModules] = useState(() => new Set(MODULES.map((m) => m.id)));
  const [showResolved, setShowResolved] = useState(false);
  const [heat, setHeat] = useState(false);
  const [dark, setDark] = useState(false);
  const [tilt, setTilt] = useState(false);

  useEffect(() => {
    onOpenRef.current = onOpenIssue;
    heatRef.current = heat;
  });

  // Only the features the filters allow
  const visible = useMemo(() => {
    if (!collection) return EMPTY;
    return {
      type: 'FeatureCollection',
      features: collection.features.filter(
        (f) => visibleModules.has(f.properties.module) && (showResolved || f.properties.status !== 'resolved')
      ),
    };
  }, [collection, visibleModules, showResolved]);

  // Create the map once
  useEffect(() => {
    const map = new GLMap({
      container: containerRef.current,
      style: MAP_STYLES.light,
      center: DEFAULT_CENTER,
      zoom: 14,
    });
    mapRef.current = map;
        // The free Liberty style references a few icons its sprite sheet lacks.
    // A blank 1x1 image stops the warnings (cosmetic only).
    map.on('styleimagemissing', (e) => {
      if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'top-right');

    map.on('style.load', () => {
      addIssueLayers(map, dataRef.current);
      map.setLayoutProperty('heat', 'visibility', heatRef.current ? 'visible' : 'none');
    });

    map.on('click', 'clusters', async (e) => {
      const feature = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
      if (!feature) return;
      const zoom = await map.getSource('issues').getClusterExpansionZoom(feature.properties.cluster_id);
      map.easeTo({ center: feature.geometry.coordinates, zoom });
    });
    map.on('click', 'points', (e) => showPopup(map, e.features[0], onOpenRef.current));
    for (const layer of ['clusters', 'points']) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
    }

    // Keep the map correct when the phone rotates or the window resizes
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // New or filtered data
  useEffect(() => {
    dataRef.current = visible;
    const map = mapRef.current;
    if (!map) return;
    map.getSource('issues')?.setData(visible);
    map.getSource('issues-heat')?.setData(visible);
  }, [visible]);

  // Zoom to fit all issues, once, when data first arrives
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fittedRef.current || !collection?.features.length) return;
    fittedRef.current = true;
    const lngs = collection.features.map((f) => f.geometry.coordinates[0]);
    const lats = collection.features.map((f) => f.geometry.coordinates[1]);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 50, maxZoom: 16, duration: 0 }
    );
  }, [collection]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer('heat')) map.setLayoutProperty('heat', 'visibility', heat ? 'visible' : 'none');
  }, [heat]);

  useEffect(() => {
    mapRef.current?.easeTo({ pitch: tilt ? 60 : 0, bearing: tilt ? -20 : 0, duration: 600 });
  }, [tilt]);

  useEffect(() => {
    const map = mapRef.current;
    const url = dark ? MAP_STYLES.dark : MAP_STYLES.light;
    if (!map || appliedStyleRef.current === url) return;
    appliedStyleRef.current = url;
    map.setStyle(url); // our layers come back through the 'style.load' handler above
  }, [dark]);

  function toggleModule(id) {
    setVisibleModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const chip = (on) =>
    `min-h-11 rounded-full border px-3 text-sm ${
      on ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-700'
    }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {MODULES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={visibleModules.has(m.id)}
            onClick={() => toggleModule(m.id)}
            className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm ${
              visibleModules.has(m.id) ? 'border-slate-400 bg-white text-slate-800' : 'border-slate-200 bg-slate-100 text-slate-400'
            }`}
          >
            <span className="size-3 rounded-full" style={{ background: m.color }} />
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={showResolved} onClick={() => setShowResolved((v) => !v)} className={chip(showResolved)}>
          Show resolved
        </button>
        <button type="button" aria-pressed={heat} onClick={() => setHeat((v) => !v)} className={chip(heat)}>
          Heatmap
        </button>
        <button type="button" aria-pressed={dark} onClick={() => setDark((v) => !v)} className={chip(dark)}>
          Dark map
        </button>
        <button type="button" aria-pressed={tilt} onClick={() => setTilt((v) => !v)} className={chip(tilt)}>
          3D tilt
        </button>
      </div>

      {/* The container needs an explicit height, or the map would be 0px tall */}
      <div
        ref={containerRef}
        role="region"
        aria-label="Issue map"
        className="h-[60dvh] min-h-[320px] w-full overflow-hidden rounded-2xl border border-slate-200"
      />
      <p className="text-xs text-slate-500">Bigger dots are more severe. Tap a numbered circle to zoom in.</p>
    </div>
  );
}