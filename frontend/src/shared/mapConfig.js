export const MODULES = [
  { id: 'streetlight', label: 'Streetlights', color: '#ca8a04' },
  { id: 'flood', label: 'Flood', color: '#2563eb' },
  { id: 'road', label: 'Road safety', color: '#ea580c' },
  { id: 'fire', label: 'Fire', color: '#dc2626' },
  { id: 'public_service', label: 'Public services', color: '#7c3aed' },
];

export const MODULE_LABELS = Object.fromEntries(MODULES.map((m) => [m.id, m.label]));

// Free vector styles from OpenFreeMap (no key). If this provider ever changes
// its terms, this is the only place to edit.
export const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

// [longitude, latitude]. This is the demo area used by the seed data.
// Change it to your real area when you are ready.
export const DEFAULT_CENTER = [77.5372, 13.2957];