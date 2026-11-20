import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import Field from '../../shared/Field.jsx';
import FullPageSpinner from '../../shared/FullPageSpinner.jsx';
import { PASSWORD_RULES } from '../../shared/passwordRules.js';
import TwoFactorStep from '../login/TwoFactorStep.jsx';
import { ROLE_LABELS, deptLabel } from '../../portals/admin/constants.js';
import Logo from '../../ui/Logo.jsx';

export default function AcceptInvitePage() {
  const { session, loading, logout } = useAuth();
  const navigate = useNavigate();

  // Read the token once from the link, then remove it from the address bar
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [phase, setPhase] = useState(token ? 'loading' : 'invalid'); // loading | invalid | form | twofactor
  const [invite, setInvite] = useState(null);
  const [form, setForm] = useState({ fullName: '', password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(null);

  useEffect(() => {
    if (!token) return;
    window.history.replaceState(window.history.state, '', window.location.pathname);
    api('POST', '/api/auth/invite/inspect', { token })
      .then((data) => {
        setInvite(data);
        setPhase('form');
      })
      .catch(() => setPhase('invalid'));
  }, [token]);

  if (loading) return <FullPageSpinner />;

  const shell = (children) => (
    <main className="grid min-h-dvh brand-wash place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <h1 className="flex justify-center"><Logo stacked /></h1>
        {children}
      </div>
    </main>
  );

  // Someone is already signed in on this browser (except while we finish 2FA)
  if (session && phase !== 'twofactor') {
    return shell(
      <div className="mt-6 space-y-4 text-center">
        <p className="text-slate-700">
          You are signed in as <strong>{session.user.fullName}</strong>. Log out first to accept an invitation.
        </p>
        <button
          type="button"
          onClick={() => logout()}
          className="min-h-11 w-full rounded-lg border border-slate-300 text-base hover:bg-slate-100"
        >
          Log out
        </button>
      </div>
    );
  }

  if (phase === 'loading') return <FullPageSpinner />;

  if (phase === 'invalid') {
    return shell(
      <div className="mt-6 space-y-4 text-center">
        <p className="text-slate-700">This invitation is invalid or has expired.</p>
        <p className="text-sm text-slate-500">Ask a Super Admin for a new one.</p>
        <Link to="/login" className="inline-block font-medium text-emerald-700 underline">
          Go to login
        </Link>
      </div>
    );
  }

  if (phase === 'twofactor') {
    return shell(
      <TwoFactorStep
        step={challenge.step}
        challengeToken={challenge.token}
        onBack={() => navigate('/login')}
        onDone={() => navigate('/admin', { replace: true })}
      />
    );
  }

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const passwordOk = PASSWORD_RULES.every((r) => r.test(form.password));

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');

    const problems = {};
    if (!passwordOk) problems.password = 'Password does not meet all the rules below';
    if (form.password !== form.confirm) problems.confirm = 'Passwords do not match';
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    try {
      const data = await api('POST', '/api/auth/invite/accept', {
        token,
        fullName: form.fullName,
        password: form.password,
      });
      setChallenge({ step: data.step, token: data.challengeToken });
      setPhase('twofactor');
    } catch (err) {
      if (err.status === 404) {
        setPhase('invalid');
      } else {
        const fromServer = {};
        for (const item of err.errors || []) {
          if (!fromServer[item.field]) fromServer[item.field] = item.message;
        }
        setFieldErrors(fromServer);
        if (Object.keys(fromServer).length === 0) setError(err.message);
        setBusy(false);
      }
    }
  }

  return shell(
    <>
      <p className="mt-1 text-center text-sm text-slate-500">You have been invited</p>
      <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        <strong>{invite.email}</strong>
        <br />
        Role: {ROLE_LABELS[invite.role] || invite.role}
        {invite.department ? ` · ${deptLabel(invite.department)}` : ''}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
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
          id="password"
          label="Choose a password"
          type="password"
          autoComplete="new-password"
          required
          maxLength={72}
          value={form.password}
          onChange={set('password')}
          error={fieldErrors.password}
        />
        <ul className="space-y-1 text-sm" aria-label="Password rules">
          {PASSWORD_RULES.map((r) => (
            <li key={r.id} className={r.test(form.password) ? 'text-emerald-700' : 'text-slate-500'}>
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
          disabled={busy}
          className="min-h-11 w-full rounded-lg bg-emerald-600 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? 'Creating account…' : 'Continue to two-factor setup'}
        </button>
      </form>
    </>
  );
}