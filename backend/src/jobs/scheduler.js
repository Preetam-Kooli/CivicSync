import cron from 'node-cron';
import { runMaintenance } from '../services/maintenanceService.js';

export function startScheduler() {
  // "*/5 * * * *" = every 5 minutes. It cannot run while a free Render service sleeps,
  // which is why ensureFresh() and the optional outside timer also exist.
  cron.schedule('*/5 * * * *', () => {
    runMaintenance('cron');
  });
  setTimeout(() => runMaintenance('startup'), 5000);
  console.log('Scheduler started: SLA check every 5 minutes');
}