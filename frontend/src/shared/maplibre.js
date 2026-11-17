import {
  Map as GLMap,
  Marker,
  Popup,
  NavigationControl,
  GeolocateControl,
  setWorkerUrl,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

// With Vite, MapLibre must be told where its background worker file is (once)
setWorkerUrl(workerUrl);

// Renamed GLMap so it never clashes with JavaScript's built-in Map
export { GLMap, Marker, Popup, NavigationControl, GeolocateControl };