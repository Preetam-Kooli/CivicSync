import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import { ROLE_LABELS } from './constants.js';

export default function AdminHome() {
  const { session } = useAuth();
  const [serverSays, setServerSays] = useState('checking…');

  useEffect(() => {
    api('GET', '/api/admin/ping')
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
          Signed in as {ROLE_LABELS[session.user.role] || session.user.role} (two-factor verified).
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Server says: <span className="font-mono">{serverSays}</span>
        </p>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Issue management</h2>
        <p className="mt-1 text-slate-600">
          Verifying, assigning, and resolving reports arrives in Phases 5 and 6.
        </p>
      </section>
    </div>
  );
}