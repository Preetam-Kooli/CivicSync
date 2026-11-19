import { env } from '../config/env.js';
import * as alertRepo from '../repositories/alertRepository.js';

const API = 'https://api.open-meteo.com/v1/forecast';
const EVERY_MS = 30 * 60 * 1000;

let lastCheck = 0;
let running = null;

// Rain expected in the next 24 hours, in millimetres, at one point
async function forecast24h(lat, lng) {
  // Testing only (ignored in production): pretend this much rain is coming
  if (env.weatherSimulateMm !== null) return env.weatherSimulateMm;

  const url = `${API}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&hourly=precipitation&forecast_days=2&timezone=UTC`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }); // never wait forever
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
  const data = await res.json();

  const times = data.hourly?.time;
  const rain = data.hourly?.precipitation;
  if (!Array.isArray(times) || !Array.isArray(rain)) throw new Error('Unexpected forecast format');

  // Times are UTC hour starts ("2026-11-19T14:00"). Sum the current hour and the next 23.
  const now = Date.now();
  let total = 0;
  times.forEach((t, i) => {
    const ts = Date.parse(`${t}Z`);
    if (ts >= now - 3_600_000 && ts < now + 24 * 3_600_000) total += rain[i] ?? 0;
  });
  return Math.round(total * 10) / 10;
}

const statusFor = (mm, zone) =>
  mm >= Number(zone.high_mm) ? 'high' : mm >= Number(zone.watch_mm) ? 'watch' : 'normal';

export function checkWeather(source = 'manual') {
  if (running) return running; // never two checks at once
  running = (async () => {
    const zones = await alertRepo.zonesForCheck();
    const summary = { zones: zones.length, checked: 0, failed: 0, alerting: 0 };
    for (const zone of zones) {
      try {
        const mm = await forecast24h(zone.lat, zone.lng);
        const status = statusFor(mm, zone);
        await alertRepo.saveForecast(zone.id, mm, status);
        await alertRepo.syncWeatherAlert(zone, status, mm);
        summary.checked++;
        if (status !== 'normal') summary.alerting++;
      } catch (err) {
        summary.failed++; // one bad zone must not stop the others
        console.error(`[weather] ${zone.name}: ${err.message}`);
      }
    }
    lastCheck = Date.now();
    console.log(`[weather:${source}]`, summary);
    return summary;
  })().finally(() => {
    running = null;
  });
  return running;
}

// Called whenever someone loads the banner. The free server sleeps, so the timer alone is not enough.
export function ensureWeatherFresh() {
  if (!running && Date.now() - lastCheck > EVERY_MS) {
    checkWeather('lazy').catch((err) => console.error('[weather] check failed:', err.message));
  }
}