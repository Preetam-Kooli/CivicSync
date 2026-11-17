import { useEffect, useRef, useState } from 'react';
import { GLMap, Marker, NavigationControl } from './maplibre.js';
import { MAP_STYLES, DEFAULT_CENTER } from './mapConfig.js';

export default function LocationPicker({ value, onChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const placeRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [message, setMessage] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const map = new GLMap({ container: containerRef.current, style: MAP_STYLES.light, center: DEFAULT_CENTER, zoom: 15 });
    mapRef.current = map;
        // The free Liberty style references a few icons its sprite sheet lacks.
    // A blank 1x1 image stops the warnings (cosmetic only).
    map.on('styleimagemissing', (e) => {
      if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    map.addControl(new NavigationControl(), 'top-right');

    let marker = null;
    const place = (lng, lat) => {
      if (!marker) {
        marker = new Marker({ draggable: true, color: '#059669' }).setLngLat([lng, lat]).addTo(map);
        marker.on('dragend', () => {
          const p = marker.getLngLat();
          onChangeRef.current({ lat: p.lat, lng: p.lng });
        });
      } else {
        marker.setLngLat([lng, lat]);
      }
      onChangeRef.current({ lat, lng });
    };
    placeRef.current = place;
    map.on('click', (e) => place(e.lngLat.lng, e.lngLat.lat));

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMessage('Your browser cannot share your location. Tap the map to choose the spot.');
      return;
    }
    setLocating(true);
    setMessage('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude, accuracy } = pos.coords;
        placeRef.current(longitude, latitude);
        mapRef.current.flyTo({ center: [longitude, latitude], zoom: 17 });
        setMessage(`Location found (accurate to about ${Math.round(accuracy)} m). Drag the pin to adjust it.`);
        setLocating(false);
      },
      (err) => {
        setMessage(
          err.code === 1
            ? 'Location permission was denied. Tap the map to choose the spot instead.'
            : 'Could not get your location. Tap the map to choose the spot instead.'
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-base hover:bg-slate-50 disabled:opacity-60"
      >
        {locating ? 'Finding you…' : 'Use my current location'}
      </button>
      <div
        ref={containerRef}
        role="region"
        aria-label="Pick the location on the map"
        className="h-[45dvh] min-h-[280px] w-full overflow-hidden rounded-xl border border-slate-300"
      />
      <p className="text-sm text-slate-600" aria-live="polite">
        {value
          ? `Selected: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
          : 'Tap the map to drop a pin, or use your current location.'}
      </p>
      {message && <p className="text-sm text-amber-800">{message}</p>}
    </div>
  );
}