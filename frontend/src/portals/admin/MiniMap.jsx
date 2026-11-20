import { useEffect, useRef } from 'react';
import { GLMap } from '../../shared/maplibre.js';
import { DEFAULT_CENTER, MAP_STYLES, MODULES } from '../../shared/mapConfig.js';
import { useTheme } from '../../theme/useTheme.js';

const color = ['match', ['get', 'module'], ...MODULES.flatMap((m) => [m.id, m.color]), '#64748b'];

export default function MiniMap({ collection }) {
  const ref = useRef(null);
  const { dark } = useTheme();
  useEffect(() => {
    const map = new GLMap({ container: ref.current, style: dark ? MAP_STYLES.dark : MAP_STYLES.light, center: DEFAULT_CENTER, zoom: 13, interactive: false });
    map.on('styleimagemissing', (e) => {
      if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    map.on('load', () => {
      const open = { type: 'FeatureCollection', features: collection.features.filter((f) => f.properties.status !== 'resolved') };
      map.addSource('p', { type: 'geojson', data: open });
      map.addLayer({ id: 'p', type: 'circle', source: 'p', paint: { 'circle-radius': 5, 'circle-color': color, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff' } });
      if (open.features.length) {
        const lngs = open.features.map((f) => f.geometry.coordinates[0]);
        const lats = open.features.map((f) => f.geometry.coordinates[1]);
        map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 24, maxZoom: 15, duration: 0 });
      }
    });
    return () => map.remove();
  }, [collection, dark]);
  return <div ref={ref} role="img" aria-label="Map of open issues" className="h-64 w-full overflow-hidden rounded-xl" />;
}