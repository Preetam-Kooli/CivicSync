const moduleParam = {
  name: 'module', in: 'query', schema: { type: 'string', enum: ['public_service', 'streetlight', 'flood', 'road', 'fire'] },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'CivicSync Open Data API',
    version: '1.0.0',
    description:
      'Read-only, anonymised civic issue data. No names, phone numbers, photos, free-text descriptions or exact addresses. Locations are rounded to about 100 m.',
  },
  servers: [{ url: '/api/open/v1' }],
  paths: {
    '/issues': {
      get: {
        summary: 'List issues (newest first)',
        parameters: [
          moduleParam,
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['reported', 'verified', 'assigned', 'in_progress', 'resolved'] } },
          { name: 'from', in: 'query', description: 'Reported on or after (YYYY-MM-DD)', schema: { type: 'string' } },
          { name: 'to', in: 'query', description: 'Reported on or before (YYYY-MM-DD)', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'geojson'], default: 'json' } },
        ],
        responses: { 200: { description: 'A page of issues, with paging information in "meta"' } },
      },
    },
    '/categories': { get: { summary: 'Issue categories and their service-level hours', responses: { 200: { description: 'List of categories' } } } },
    '/stats/monthly': { get: { summary: 'Reported and resolved counts per month and module', responses: { 200: { description: 'Monthly counts' } } } },
  },
};