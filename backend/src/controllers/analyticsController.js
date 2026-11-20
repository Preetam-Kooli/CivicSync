import * as svc from '../services/analyticsService.js';
import { openApiSpec } from '../config/openApiSpec.js';

const actorFrom = (req) => ({ role: req.auth.role, department: req.auth.user.department });
const cache = (res) => res.set('Cache-Control', 'public, max-age=300'); // 5 minutes

// ----- Admin -----
export async function adminAnalytics(req, res) {
  res.json(await svc.adminAnalytics(req.query, actorFrom(req)));
}
export async function hotspots(req, res) {
  res.json(await svc.hotspots(req.query, actorFrom(req)));
}

// ----- Public and open data (no login) -----
export async function transparency(req, res) {
  cache(res);
  res.json(await svc.transparency());
}

export async function openIssues(req, res) {
  const { meta, items } = await svc.openIssues(req.query);
  cache(res);
  if (req.query.format === 'geojson') {
    return res.json({
      type: 'FeatureCollection',
      meta,
      features: items.map(({ location, ...properties }) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
        properties,
      })),
    });
  }
  res.json({ meta, data: items });
}

export async function openCategories(req, res) {
  cache(res);
  res.json({ data: await svc.openCategories() });
}

export async function openMonthly(req, res) {
  cache(res);
  res.json({ data: await svc.openMonthly() });
}

export function openApi(req, res) {
  cache(res);
  res.json(openApiSpec);
}

export async function summary(req, res) {
  res.json(await svc.adminSummary(actorFrom(req)));
}
export async function reports(req, res) {
  res.json(await svc.adminReports(req.query, actorFrom(req)));
}