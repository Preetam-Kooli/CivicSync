import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import FullPageSpinner from '../../shared/FullPageSpinner.jsx';
import TwoFactorStep from './TwoFactorStep.jsx';
import Logo from '../../ui/Logo.jsx';

const PORTALS = [
  { id: 'citizen', label: 'Citizen' },
  { id: 'admin', label: 'Admin' },
];

export default function LoginPage() {
  const { session, loading, login } = useAuth();
  const [portal, setPortal] = useState('citizen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Set after an admin passes the password step: { step, token }
  const [challenge, setChallenge] = useState(null);

  if (loading) return <FullPageSpinner />;

  // Already logged in (or just finished 2FA)? Go straight to your dashboard.
  if (session) {
    return <Navigate to={session.portal === 'admin' ? '/admin' : '/citizen'} replace />;
  }

  function choosePortal(id) {
    setPortal(id);
    setError('');
    setPassword('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const data = await login(email, password, portal);
      if (data.step) {
        setChallenge({ step: data.step, token: data.challengeToken });
        setPassword('');
      }
    } catch (err) {
      setError(err.errors?.[0]?.message || err.message);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh brand-wash place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <h1 className="flex justify-center"><Logo stacked /></h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Public services and community safety in one place
        </p>

        {challenge ? (
          <TwoFactorStep
            step={challenge.step}
            challengeToken={challenge.token}
            onBack={() => setChallenge(null)}
          />
        ) : (
          <>
            {/* The tab is only a request. The server decides whether you may enter. */}
            <div
              role="tablist"
              aria-label="Sign in as"
              className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
            >
              {PORTALS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={portal === p.id}
                  onClick={() => choosePortal(p.id)}
                  className={`min-h-11 rounded-lg text-base font-medium transition ${
                    portal === p.id
                      ? 'bg-white text-emerald-700 shadow'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="min-h-11 w-full rounded-lg bg-emerald-600 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitting ? 'Signing in…' : portal === 'admin' ? 'Continue' : 'Log in'}
              </button>
            </form>

            {portal === 'citizen' && (
              <p className="mt-4 text-center text-sm text-slate-600">
                New here?{' '}
                <Link to="/register" className="font-medium text-emerald-700 underline">
                  Create an account
                </Link>
              </p>
            )}

            {portal === 'admin' && (
              <p className="mt-4 text-center text-xs text-slate-500">
                Admin and staff accounts are created by invitation from a Super Admin.
              </p>
            )}

            <p className="mt-4 text-center text-sm text-slate-600">
              <Link to="/transparency" className="underline">See how issues are being resolved</Link>
              {' · '}
              <Link to="/open-data" className="underline">Open data</Link>
            </p>

            {/* Only appears when running locally. Never in the production build. */}
            {import.meta.env.DEV && (
              <p className="mt-6 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Dev only: {portal === 'citizen' ? 'citizen1@civicsync.test' : 'superadmin@civicsync.test'}{' '}
                / Passw0rd!
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}