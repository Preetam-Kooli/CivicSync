import { useEffect, useRef } from 'react';
import { GLMap, NavigationControl, Popup } from './maplibre.js';
import { MAP_STYLES, DEFAULT_CENTER, MODULE_LABELS } from './mapConfig.js';

const EMPTY = { type: 'FeatureCollection', features: [] };

function addHotLayers(map, data) {
  if (map.getSource('hot')) return;
  map.addSource('hot', { type: 'geojson', data });
  map.addLayer({
    id: 'hot-fill', type: 'fill', source: 'hot',
    paint: { 'fill-color': '#f97316', 'fill-opacity': 0.55 },
  });
  map.addLayer({
    id: 'hot-line', type: 'line', source: 'hot',
    paint: { 'line-color': '#9a3412', 'line-width': 1.5 },
  });
}

function colorFor(max) {
  // Pale yellow (low) -> orange -> dark red (highest score)
  return ['interpolate', ['linear'], ['get', 'score'], 0, '#fde68a', max / 2, '#f97316', max, '#b91c1c'];
}

export default function HotspotMap({ collection }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const dataRef = useRef(EMPTY);

  useEffect(() => {
    const map = new GLMap({ container: containerRef.current, style: MAP_STYLES.light, center: DEFAULT_CENTER, zoom: 14 });
    mapRef.current = map;
    map.addControl(new NavigationControl(), 'top-right');
    map.on('styleimagemissing', (e) => {
      if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    map.on('style.load', () => addHotLayers(map, dataRef.current));

    map.on('click', 'hot-fill', (e) => {
      const p = e.features[0].properties;
      const box = document.createElement('div');
      box.style.cssText = 'font: 14px/1.4 system-ui, sans-serif; min-width: 180px';
      const title = document.createElement('strong');
      title.textContent = `${p.topCategory} (${MODULE_LABELS[p.topModule] || p.topModule})`;
      const lines = [
        `${p.issues} issues, ${p.reports} reports`,
        `${p.recent} in the last 30 days`,
        `Active in ${p.monthsActive} different month${Number(p.monthsActive) === 1 ? '' : 's'}`,
        `Score ${p.score}`,
      ];
      box.append(title, ...lines.map((t) => Object.assign(document.createElement('div'), { textContent: t })));
      new Popup({ maxWidth: '260px' }).setLngLat(e.lngLat).setDOMContent(box).addTo(map);
    });
    map.on('mouseenter', 'hot-fill', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'hot-fill', () => (map.getCanvas().style.cursor = ''));

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const data = collection || EMPTY;
    dataRef.current = data;
    if (!map) return;
    const max = Math.max(3, ...data.features.map((f) => f.properties.score));
    map.getSource('hot')?.setData(data);
    if (map.getLayer('hot-fill')) map.setPaintProperty('hot-fill', 'fill-color', colorFor(max));
    if (data.features.length) {
      const pts = data.features.flatMap((f) => f.geometry.coordinates[0]);
      const lngs = pts.map((c) => c[0]);
      const lats = pts.map((c) => c[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
        padding: 60, maxZoom: 16, duration: 0,
      });
    }
  }, [collection]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Hotspot map"
      className="h-[50dvh] min-h-[300px] w-full overflow-hidden rounded-2xl border border-slate-200"
    />
  );
}