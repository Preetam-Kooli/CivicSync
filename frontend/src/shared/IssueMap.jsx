import { useEffect, useMemo, useRef, useState } from 'react';
import { CloudRain, Eye, Flame, Layers, Megaphone, Moon } from 'lucide-react';
import { GLMap, NavigationControl, GeolocateControl, Popup } from './maplibre.js';
import { MAP_STYLES, DEFAULT_CENTER, MODULES } from './mapConfig.js';
import { useTheme } from '../theme/useTheme.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const colorByModule = ['match', ['get', 'module'], ...MODULES.flatMap((m) => [m.id, m.color]), '#64748b'];
const zoneColor = ['match', ['get', 'status'], 'high', '#dc2626', 'watch', '#f59e0b', '#3b82f6'];
const areaColor = ['match', ['get', 'severity'], 'critical', '#dc2626', 'warning', '#f59e0b', '#0284c7'];

function addOverlays(map, zones, areas) {
  if (!map.getSource('zones')) {
    map.addSource('zones', { type: 'geojson', data: zones });
    map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': zoneColor, 'fill-opacity': ['match', ['get', 'status'], 'high', 0.35, 'watch', 0.25, 0.1] } });
    map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': zoneColor, 'line-width': 2, 'line-dasharray': [2, 2] } });
  }
  if (!map.getSource('areas')) {
    map.addSource('areas', { type: 'geojson', data: areas });
    map.addLayer({ id: 'areas-fill', type: 'fill', source: 'areas', paint: { 'fill-color': areaColor, 'fill-opacity': 0.22 } });
    map.addLayer({ id: 'areas-line', type: 'line', source: 'areas', paint: { 'line-color': areaColor, 'line-width': 2.5 } });
  }
}

function addIssueLayers(map, data) {
  if (map.getSource('issues')) return;
  map.addSource('issues', { type: 'geojson', data, cluster: true, clusterMaxZoom: 15, clusterRadius: 45 });
  map.addSource('issues-heat', { type: 'geojson', data });
  map.addLayer({ id: 'heat', type: 'heatmap', source: 'issues-heat', layout: { visibility: 'none' },
    paint: { 'heatmap-weight': ['interpolate', ['linear'], ['get', 'severity'], 1, 0.3, 5, 1], 'heatmap-radius': 30, 'heatmap-opacity': 0.7,
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.3, '#fde68a', 0.6, '#f97316', 1, '#dc2626'] } });
  map.addLayer({ id: 'clusters', type: 'circle', source: 'issues', filter: ['has', 'point_count'],
    paint: { 'circle-color': '#14856e', 'circle-radius': ['step', ['get', 'point_count'], 17, 10, 22, 30, 28], 'circle-stroke-width': 4, 'circle-stroke-color': 'rgba(35,169,142,0.35)' } });
  map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'issues', filter: ['has', 'point_count'],
    layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 13, 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#ffffff' } });
  map.addLayer({ id: 'points', type: 'circle', source: 'issues', filter: ['!', ['has', 'point_count']],
    paint: { 'circle-color': colorByModule, 'circle-radius': ['interpolate', ['linear'], ['get', 'severity'], 1, 6, 5, 11], 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });
}

// Popups are built from text nodes, never HTML strings, so typed text can never run as code
function popup(map, lngLat, rows) {
  const box = document.createElement('div');
  box.style.cssText = 'font: 14px/1.4 system-ui, sans-serif; min-width: 160px';
  rows.forEach(([text, strong]) => box.append(Object.assign(document.createElement(strong ? 'strong' : 'div'), { textContent: text })));
  new Popup({ maxWidth: '260px' }).setLngLat(lngLat).setDOMContent(box).addTo(map);
}

function showZone(map, e) {
  const p = e.features[0].properties;
  const risk = { normal: 'No flood risk expected', watch: 'Heavy rain watch', high: 'High flood risk' }[p.status];
  const rows = [[p.name, true], [risk]];
  if (p.forecastMm !== undefined && p.forecastMm !== 'null') rows.push([`Forecast: ${p.forecastMm} mm in 24 h`]);
  popup(map, e.lngLat, rows);
}

function showArea(map, e) {
  const p = e.features[0].properties;
  const rows = [[p.title, true], [p.message]];
  if (p.locationName && p.locationName !== 'null') rows.push([`📍 ${p.locationName}`]);
  popup(map, e.lngLat, rows);
}

const Tool = ({ icon: Icon, label, on, ...p }) => (
  <button type="button" aria-label={label} title={label} aria-pressed={on} {...p}
    className={`grid size-11 place-items-center rounded-xl border shadow-md ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}><Icon size={20} /></button>
);

export default function IssueMap({ collection, zones, areas, onSelect, className = '' }) {
  const { dark: appDark } = useTheme();
  const [darkOverride, setDarkOverride] = useState(null);
  const dark = darkOverride ?? appDark;
  const initialStyle = useRef(dark ? MAP_STYLES.dark : MAP_STYLES.light);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const dataRef = useRef(EMPTY);
  const zonesRef = useRef(EMPTY);
  const areasRef = useRef(EMPTY);
  const fittedRef = useRef(false);
  const appliedStyleRef = useRef(dark ? MAP_STYLES.dark : MAP_STYLES.light);
  const heatRef = useRef(false);
  const showZonesRef = useRef(true);
  const showAreasRef = useRef(true);
  const onSelectRef = useRef(onSelect);

  const [visibleModules, setVisibleModules] = useState(() => new Set(MODULES.map((m) => m.id)));
  const [showResolved, setShowResolved] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [showAreas, setShowAreas] = useState(true);
  const [heat, setHeat] = useState(false);
  const [tilt, setTilt] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
    heatRef.current = heat;
    showZonesRef.current = showZones;
    showAreasRef.current = showAreas;
  });

  const visible = useMemo(() => {
    if (!collection) return EMPTY;
    return { type: 'FeatureCollection', features: collection.features.filter((f) => visibleModules.has(f.properties.module) && (showResolved || f.properties.status !== 'resolved')) };
  }, [collection, visibleModules, showResolved]);

  const counts = useMemo(() => {
    const c = {};
    for (const f of collection?.features ?? []) if (f.properties.status !== 'resolved') c[f.properties.module] = (c[f.properties.module] || 0) + 1;
    return c;
  }, [collection]);

  useEffect(() => {
    const map = new GLMap({ container: containerRef.current, style: initialStyle.current, center: DEFAULT_CENTER, zoom: 14 });
    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-left');
    map.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'bottom-left');
    map.on('styleimagemissing', (e) => {
      if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    // If the dark base map cannot be fetched, fall back to the light one instead of showing nothing
    map.on('error', (e) => {
      if (e.error?.status === 404 && String(e.error?.url).includes('/styles/') && appliedStyleRef.current === MAP_STYLES.dark) {
        appliedStyleRef.current = MAP_STYLES.light;
        setDarkOverride(false);
        map.setStyle(MAP_STYLES.light);
      }
    });
    map.on('style.load', () => {
      addOverlays(map, zonesRef.current, areasRef.current);
      addIssueLayers(map, dataRef.current);
      map.setLayoutProperty('heat', 'visibility', heatRef.current ? 'visible' : 'none');
      for (const id of ['zones-fill', 'zones-line']) map.setLayoutProperty(id, 'visibility', showZonesRef.current ? 'visible' : 'none');
      for (const id of ['areas-fill', 'areas-line']) map.setLayoutProperty(id, 'visibility', showAreasRef.current ? 'visible' : 'none');
    });
    map.on('click', 'clusters', async (e) => {
      const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
      if (!f) return;
      const zoom = await map.getSource('issues').getClusterExpansionZoom(f.properties.cluster_id);
      map.easeTo({ center: f.geometry.coordinates, zoom });
    });
    map.on('click', 'points', (e) => onSelectRef.current?.(e.features[0].properties));
    const underneath = (e) => map.queryRenderedFeatures(e.point, { layers: ['points', 'clusters'] }).length > 0;
    map.on('click', 'areas-fill', (e) => { if (!underneath(e)) showArea(map, e); });
    map.on('click', 'zones-fill', (e) => {
      if (underneath(e) || map.queryRenderedFeatures(e.point, { layers: ['areas-fill'] }).length) return;
      showZone(map, e);
    });
    for (const layer of ['clusters', 'points', 'zones-fill', 'areas-fill']) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
    }
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    dataRef.current = visible;
    const map = mapRef.current;
    if (!map) return;
    map.getSource('issues')?.setData(visible);
    map.getSource('issues-heat')?.setData(visible);
  }, [visible]);

  useEffect(() => {
    zonesRef.current = zones || EMPTY;
    mapRef.current?.getSource('zones')?.setData(zonesRef.current);
  }, [zones]);

  useEffect(() => {
    areasRef.current = areas || EMPTY;
    mapRef.current?.getSource('areas')?.setData(areasRef.current);
  }, [areas]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || fittedRef.current || !collection?.features.length) return;
    fittedRef.current = true;
    const lngs = collection.features.map((f) => f.geometry.coordinates[0]);
    const lats = collection.features.map((f) => f.geometry.coordinates[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 70, maxZoom: 16, duration: 0 });
  }, [collection]);

  useEffect(() => { const m = mapRef.current; if (m?.getLayer('heat')) m.setLayoutProperty('heat', 'visibility', heat ? 'visible' : 'none'); }, [heat]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m?.getLayer('zones-fill')) return;
    for (const id of ['zones-fill', 'zones-line']) m.setLayoutProperty(id, 'visibility', showZones ? 'visible' : 'none');
  }, [showZones]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m?.getLayer('areas-fill')) return;
    for (const id of ['areas-fill', 'areas-line']) m.setLayoutProperty(id, 'visibility', showAreas ? 'visible' : 'none');
  }, [showAreas]);
  useEffect(() => { mapRef.current?.easeTo({ pitch: tilt ? 60 : 0, bearing: tilt ? -20 : 0, duration: 600 }); }, [tilt]);
  useEffect(() => {
    const m = mapRef.current;
    const url = dark ? MAP_STYLES.dark : MAP_STYLES.light;
    if (!m || appliedStyleRef.current === url) return;
    appliedStyleRef.current = url;
    m.setStyle(url);
  }, [dark]);

  const toggleModule = (id) => setVisibleModules((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-slate-200 ${className}`}>
      {/* MapLibre forces position:relative on this element, so it is sized with height, not "absolute inset-0" */}
      <div ref={containerRef} role="region" aria-label="Issue map" className="h-full w-full" />

      {/* Phone: one scrollable row of category chips floating over the map */}
      <div className="no-scrollbar absolute inset-x-3 top-3 z-10 flex gap-2 overflow-x-auto lg:hidden">
        {MODULES.map((m) => (
          <button key={m.id} type="button" aria-pressed={visibleModules.has(m.id)} onClick={() => toggleModule(m.id)}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold shadow-md ${visibleModules.has(m.id) ? 'border-slate-200 bg-white text-slate-800' : 'border-slate-200 bg-slate-100 text-slate-400'}`}>
            <span className="size-2.5 rounded-full" style={{ background: m.color }} />{m.label}
          </button>
        ))}
      </div>

      {/* Desktop: floating categories panel */}
      <aside className="absolute left-3 top-3 z-10 hidden w-56 rounded-2xl bg-white p-4 shadow-lg lg:block">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Categories</p>
        <ul className="mt-2 space-y-1">
          {MODULES.map((m) => (
            <li key={m.id}>
              <button type="button" aria-pressed={visibleModules.has(m.id)} onClick={() => toggleModule(m.id)} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-sm font-medium hover:bg-slate-100 ${visibleModules.has(m.id) ? 'text-slate-800' : 'text-slate-400'}`}>
                <span className="size-3 rounded-full" style={{ background: m.color }} /><span className="flex-1 text-left">{m.label}</span><b>{counts[m.id] || 0}</b>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="absolute right-3 top-16 z-10 flex flex-col gap-2 lg:top-3">
        <Tool icon={Flame} label="Heatmap" on={heat} onClick={() => setHeat((v) => !v)} />
        <Tool icon={CloudRain} label="Flood zones" on={showZones} onClick={() => setShowZones((v) => !v)} />
        <Tool icon={Megaphone} label="Announcements" on={showAreas} onClick={() => setShowAreas((v) => !v)} />
        <Tool icon={Eye} label="Show resolved" on={showResolved} onClick={() => setShowResolved((v) => !v)} />
        <Tool icon={Moon} label="Dark map" on={dark} onClick={() => setDarkOverride(!dark)} />
        <Tool icon={Layers} label="3D tilt" on={tilt} onClick={() => setTilt((v) => !v)} />
      </div>
    </div>
  );
}