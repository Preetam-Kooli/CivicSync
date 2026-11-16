import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../auth/useAuth.js';

// Shown after the password step for admins. Two modes:
//  - totp_required:        just ask for the 6-digit code
//  - totp_setup_required:  first show a QR code to scan, then ask for the code
export default function TwoFactorStep({ step, challengeToken, onBack, onDone }) {
  const { completeTwoFactor } = useAuth();
  const isSetup = step === 'totp_setup_required';

  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  // Fetch the QR code once. The ref stops React's development double-run from
  // creating two different secrets.
  useEffect(() => {
    if (!isSetup || started.current) return;
    started.current = true;
    api('POST', '/api/auth/2fa/setup', { challengeToken })
      .then(setEnrollment)
      .catch((err) => setError(err.message));
  }, [isSetup, challengeToken]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await completeTwoFactor(challengeToken, code);
      onDone?.();
    } catch (err) {
      setError(err.errors?.[0]?.message || err.message);
      setCode('');
      setBusy(false);
    }
  }

  const ready = !isSetup || enrollment;

  return (
    <div>
      <h2 className="mt-6 text-center text-lg font-semibold text-slate-800">
        {isSetup ? 'Set up two-factor authentication' : 'Two-factor authentication'}
      </h2>

      {isSetup ? (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Install an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…).</li>
          <li>Scan the QR code below, or type the key by hand.</li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
      ) : (
        <p className="mt-2 text-center text-sm text-slate-600">
          Enter the 6-digit code from your authenticator app.
        </p>
      )}

      {isSetup && enrollment && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <img
            src={enrollment.qrDataUrl}
            alt="QR code to add CivicSync to your authenticator app"
            width="220"
            height="220"
            className="rounded-lg border border-slate-200"
          />
          <p className="text-xs text-slate-500">Can’t scan? Enter this key in the app:</p>
          <code className="break-all rounded bg-slate-100 px-2 py-1 text-center text-sm">
            {enrollment.secret.match(/.{1,4}/g).join(' ')}
          </code>
        </div>
      )}

      {isSetup && !enrollment && !error && (
        <p className="mt-4 text-center text-sm text-slate-500">Preparing your QR code…</p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-slate-700">
            6-digit code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-center text-xl tracking-[0.4em] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || code.length !== 6 || !ready}
          className="min-h-11 w-full rounded-lg bg-emerald-600 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? 'Checking…' : isSetup ? 'Verify and sign in' : 'Verify'}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="min-h-11 w-full rounded-lg text-base text-slate-600 hover:bg-slate-100"
        >
          Back to login
        </button>
      </form>
    </div>
  );
}