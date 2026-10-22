import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';

export default function CitizenHome() {
  const { session, logout } = useAuth();
  const [serverSays, setServerSays] = useState('checking…');

  useEffect(() => {
    api('GET', '/api/citizen/ping')
      .then((data) => setServerSays(data.message))
      .catch((err) => setServerSays(`error: ${err.message}`));
  }, []);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl p-4 sm:p-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-emerald-700">CivicSync</h1>
        <button
          type="button"
          onClick={() => logout()}
          className="min-h-11 rounded-lg border border-slate-300 px-4 text-base hover:bg-slate-100"
        >
          Log out
        </button>
      </header>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
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
    </main>
  );
}