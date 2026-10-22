import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import FullPageSpinner from '../../shared/FullPageSpinner.jsx';

// These mirror the server's rules, so the user sees them while typing.
// The server checks again: browser checks can always be bypassed.
const RULES = [
  { id: 'len', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'num', label: 'A number', test: (p) => /[0-9]/.test(p) },
];

// One labelled input with its error message, so the form below stays readable
function Field({ id, label, error, hint, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-1 min-h-11 w-full rounded-lg border px-3 text-base focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-400 focus:ring-red-100'
            : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-200'
        }`}
        {...inputProps}
      />
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const { session, loading, login } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <FullPageSpinner />;
  if (session) {
    return <Navigate to={session.portal === 'admin' ? '/admin' : '/citizen'} replace />;
  }

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const passwordOk = RULES.every((r) => r.test(form.password));

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError('');

    const problems = {};
    if (!passwordOk) problems.password = 'Password does not meet all the rules below';
    if (form.password !== form.confirm) problems.confirm = 'Passwords do not match';
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setSubmitting(true);
    try {
      const body = { fullName: form.fullName, email: form.email, password: form.password };
      if (form.phone.trim()) body.phone = form.phone; // optional: leave it out if empty
      await api('POST', '/api/auth/register', body);
    } catch (err) {
      const fromServer = {};
      for (const item of err.errors || []) {
        if (!fromServer[item.field]) fromServer[item.field] = item.message;
      }
      if (err.status === 409) fromServer.email = err.message;
      setFieldErrors(fromServer);
      if (Object.keys(fromServer).length === 0) setError(err.message);
      setSubmitting(false);
      return;
    }

    // Account created. Sign in automatically: on success the session updates
    // and the <Navigate> above sends the user to their dashboard.
    try {
      await login(form.email, form.password, 'citizen');
    } catch {
      setError('Account created. Please log in.');
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-center text-3xl font-bold text-emerald-700">CivicSync</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Create a citizen account</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <Field
            id="fullName"
            label="Full name"
            type="text"
            autoComplete="name"
            required
            value={form.fullName}
            onChange={set('fullName')}
            error={fieldErrors.fullName}
          />
          <Field
            id="email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={set('email')}
            error={fieldErrors.email}
          />
          <Field
            id="phone"
            label="Phone (optional)"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={set('phone')}
            error={fieldErrors.phone}
          />
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            maxLength={72}
            value={form.password}
            onChange={set('password')}
            error={fieldErrors.password}
          />

          <ul className="space-y-1 text-sm" aria-label="Password rules">
            {RULES.map((r) => (
              <li
                key={r.id}
                className={r.test(form.password) ? 'text-emerald-700' : 'text-slate-500'}
              >
                {r.test(form.password) ? '✓' : '○'} {r.label}
              </li>
            ))}
          </ul>

          <Field
            id="confirm"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            required
            maxLength={72}
            value={form.confirm}
            onChange={set('confirm')}
            error={fieldErrors.confirm}
          />

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
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-emerald-700 underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}