import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import Field from '../../shared/Field.jsx';
import { DEPARTMENTS, ROLE_LABELS, deptLabel } from './constants.js';

const selectClass =
  'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200';

const STATUS_STYLE = {
  pending: 'bg-amber-50 text-amber-800',
  used: 'bg-emerald-50 text-emerald-700',
  revoked: 'bg-slate-100 text-slate-600',
  expired: 'bg-slate-100 text-slate-600',
};

export default function InvitesPage() {
  const { session } = useAuth();
  const isSuper = session.user.role === 'super_admin';

  const [invites, setInvites] = useState(null);
  const [form, setForm] = useState({ email: '', role: 'staff', department: 'public_service' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null); // { link, email, expiresAt }
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api('GET', '/api/admin/invites');
      setInvites(data.invites);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (isSuper) load();
  }, [isSuper, load]);

  if (!isSuper) {
    return <p className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm">Only Super Admins can send invitations.</p>;
  }

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  async function handleCreate(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setFieldErrors({});
    setCreated(null);
    setCopied(false);
    setBusy(true);
    try {
      const body = { email: form.email, role: form.role };
      if (form.role === 'staff') body.department = form.department;
      const data = await api('POST', '/api/admin/invites', body);
      setCreated({
        link: `${window.location.origin}/accept-invite?token=${data.token}`,
        email: data.invite.email,
        expiresAt: data.invite.expiresAt,
      });
      setForm((f) => ({ ...f, email: '' }));
      await load();
    } catch (err) {
      const fromServer = {};
      for (const item of err.errors || []) {
        if (!fromServer[item.field]) fromServer[item.field] = item.message;
      }
      setFieldErrors(fromServer);
      if (Object.keys(fromServer).length === 0) setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
    } catch {
      setError('Could not copy automatically. Select the link and copy it by hand.');
    }
  }

  async function revoke(invite) {
    if (!window.confirm(`Revoke the invitation for ${invite.email}?`)) return;
    try {
      await api('DELETE', `/api/admin/invites/${invite.id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-800">Invitations</h1>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Invite a staff member or admin</h2>
        <form onSubmit={handleCreate} className="mt-4 space-y-4" noValidate>
          <Field
            id="invite-email"
            label="Email"
            type="email"
            inputMode="email"
            required
            value={form.email}
            onChange={set('email')}
            error={fieldErrors.email}
          />
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700">
              Role
            </label>
            <select id="invite-role" value={form.role} onChange={set('role')} className={selectClass}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {form.role === 'staff' && (
            <div>
              <label htmlFor="invite-dept" className="block text-sm font-medium text-slate-700">
                Department
              </label>
              <select id="invite-dept" value={form.department} onChange={set('department')} className={selectClass}>
                {DEPARTMENTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              {fieldErrors.department && <p className="mt-1 text-sm text-red-600">{fieldErrors.department}</p>}
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-lg bg-emerald-600 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto sm:px-6"
          >
            {busy ? 'Creating…' : 'Create invitation link'}
          </button>
        </form>

        {created && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">
              Invitation for {created.email}. This link is shown only once, so copy it now and send it to them yourself.
            </p>
            <code className="mt-2 block break-all rounded bg-white p-2 text-xs text-slate-700">{created.link}</code>
            <button
              type="button"
              onClick={copyLink}
              className="mt-3 min-h-11 rounded-lg border border-amber-300 bg-white px-4 text-base hover:bg-amber-100"
            >
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
            <p className="mt-2 text-xs text-amber-800">
              Valid until {new Date(created.expiresAt).toLocaleString()}. It works once.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">All invitations</h2>
        {!invites && !error && <p className="text-slate-500">Loading…</p>}
        {invites?.length === 0 && <p className="text-slate-500">No invitations yet.</p>}
        <ul className="space-y-3">
          {invites?.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{i.email}</p>
                <p className="text-sm text-slate-500">
                  {ROLE_LABELS[i.role] || i.role}
                  {i.department ? ` · ${deptLabel(i.department)}` : ''}
                  {i.createdBy ? ` · by ${i.createdBy}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[i.status]}`}>{i.status}</span>
                {i.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => revoke(i)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-100"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}