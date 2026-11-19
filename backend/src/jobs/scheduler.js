import cron from 'node-cron';
import { runMaintenance } from '../services/maintenanceService.js';
import { checkWeather } from '../services/weatherService.js';

export function startScheduler() {
  // Every 5 minutes: SLA escalation, auto-confirm, priorities, analytics refresh
  cron.schedule('*/5 * * * *', () => {
    runMaintenance('cron');
  });
  // Every 30 minutes: weather forecast for the flood zones
  cron.schedule('*/30 * * * *', () => {
    checkWeather('cron').catch((err) => console.error('[weather] failed:', err.message));
  });

  setTimeout(() => runMaintenance('startup'), 5000);
  setTimeout(() => checkWeather('startup').catch(() => {}), 10_000);
  console.log('Scheduler started: SLA check every 5 minutes, weather every 30 minutes');
}