import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';

export default function CitizenHome() {
  const { session } = useAuth();
  const [serverSays, setServerSays] = useState('checking…');

  useEffect(() => {
    api('GET', '/api/citizen/ping')
      .then((data) => setServerSays(data.message))
      .catch((err) => setServerSays(`error: ${err.message}`));
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-lg">
          Welcome, <strong>{session.user.fullName}</strong>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Citizen portal, signed in as {session.user.role}.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Server says: <span className="font-mono">{serverSays}</span>
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/citizen/report"
          className="rounded-2xl bg-emerald-600 p-6 text-white shadow-sm transition hover:bg-emerald-700"
        >
          <h2 className="text-lg font-semibold">Report an issue</h2>
          <p className="mt-1 text-sm text-emerald-50">
            Potholes, streetlights, flooding, fire hazards.
          </p>
        </Link>
        <Link
          to="/citizen/reports"
          className="rounded-2xl bg-white p-6 shadow-sm transition hover:bg-slate-50"
        >
          <h2 className="text-lg font-semibold text-slate-800">My reports</h2>
          <p className="mt-1 text-sm text-slate-500">Track what you have reported.</p>
        </Link>
      </section>
    </div>
  );
}