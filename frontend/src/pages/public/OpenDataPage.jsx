import PublicShell from '../../shared/PublicShell.jsx';

function Code({ children }) {
  return <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-sm text-slate-100"><code>{children}</code></pre>;
}

export default function OpenDataPage() {
  const base = window.location.origin;
  return (
    <PublicShell>
      <h1 className="text-3xl font-semibold text-slate-800">Open data API</h1>
      <p className="text-slate-600">
        Free, read-only data about civic issues, for researchers and other apps. Please credit CivicSync when you use it.
      </p>

      <section className="space-y-2 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">What is not included</h2>
        <p className="text-slate-600">
          No names, phone numbers, email addresses, photos, titles or free-text descriptions. Locations are rounded to about
          100 metres, so exact home addresses cannot be recovered.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Endpoints</h2>
        <p className="text-sm text-slate-600"><code>GET /api/open/v1/issues</code>: newest first. Filters: <code>module</code>, <code>status</code>, <code>from</code>, <code>to</code> (YYYY-MM-DD), <code>limit</code> (up to 500), <code>offset</code>, and <code>format=geojson</code>.</p>
        <p className="text-sm text-slate-600"><code>GET /api/open/v1/categories</code>: the categories and their deadline hours.</p>
        <p className="text-sm text-slate-600"><code>GET /api/open/v1/stats/monthly</code>: reported and resolved counts per month and area.</p>
        <p className="text-sm text-slate-600">
          Machine-readable description: <a className="font-medium text-emerald-700 underline" href="/api/open/v1/openapi.json">openapi.json</a>
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Examples</h2>
        <Code>{`curl "${base}/api/open/v1/issues?module=road&status=resolved&limit=5"`}</Code>
        <Code>{`fetch("${base}/api/open/v1/issues?format=geojson&limit=50")
  .then((r) => r.json())
  .then((geojson) => console.log(geojson.features.length));`}</Code>
        <p className="text-sm text-slate-500">Responses are cached for 5 minutes. Please keep to about 100 requests per 15 minutes.</p>
      </section>
    </PublicShell>
  );
}