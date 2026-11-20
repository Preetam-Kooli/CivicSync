import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, KeyRound, LogOut, Monitor, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { useTheme } from '../../theme/useTheme.js';
import { useToast } from '../../ui/toastContext.js';
import { api } from '../../lib/api.js';
import PageHeader from '../../shell/PageHeader.jsx';
import Button from '../../ui/Button.jsx';
import { Avatar, Badge, Card } from '../../ui/Surface.jsx';
import { ConfirmDialog } from '../../ui/Overlay.jsx';
import Field from '../../shared/Field.jsx';
import { ROLE_LABELS } from '../../portals/admin/constants.js';

const THEMES = [
  { id: 'light', label: 'Light', icon: Sun, preview: 'bg-[#f3faf8]', bar: 'bg-white' },
  { id: 'dark', label: 'Dark', icon: Moon, preview: 'bg-[#0a111d]', bar: 'bg-[#111b2b]' },
  { id: 'system', label: 'System', icon: Monitor, preview: 'bg-[linear-gradient(90deg,#f3faf8_50%,#0a111d_50%)]', bar: 'bg-[linear-gradient(90deg,#fff_50%,#111b2b_50%)]' },
];
const fieldErrors = (err) => Object.fromEntries((err.errors || []).map((e) => [e.field, e.message]));

export default function SettingsPage() {
  const { session, logout, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const user = session.user;
  const adminSide = ['staff', 'admin', 'super_admin'].includes(user.role);

  const [profile, setProfile] = useState({ fullName: user.fullName, phone: user.phone || '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy('profile');
    setErrs({});
    try {
      const d = await api('PATCH', '/api/auth/profile', profile);
      updateUser(d.user);
      toast('Profile saved');
    } catch (err) {
      setErrs(fieldErrors(err));
      if (!err.errors) toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (pw.next !== pw.confirm) return setErrs({ confirm: 'Passwords do not match' });
    setBusy('password');
    setErrs({});
    try {
      await api('POST', '/api/auth/change-password', { currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '', confirm: '' });
      toast('Password changed. Other devices were signed out.');
    } catch (err) {
      const f = fieldErrors(err);
      setErrs({ current: f.currentPassword, next: f.newPassword });
      if (!err.errors) toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function signOutEverywhere() {
    setBusy('all');
    try {
      await api('POST', '/api/auth/logout-all');
    } finally {
      await logout();
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" subtitle="Your profile, appearance and security" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-4">
            <Avatar name={user.fullName} size={64} />
            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-slate-900">{user.fullName}</p>
              <p className="truncate text-sm text-slate-500">{user.email}</p>
              <div className="mt-2 flex gap-2"><Badge tone="green">{ROLE_LABELS[user.role] || user.role}</Badge>{adminSide && <Badge tone={user.totpEnabled ? 'blue' : 'amber'}>{user.totpEnabled ? '2FA on' : '2FA off'}</Badge>}</div>
            </div>
          </div>
          <form onSubmit={saveProfile} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate>
            <Field id="fullName" label="Full name" value={profile.fullName} onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))} error={errs.fullName} />
            <Field id="phone" label="Phone (optional)" type="tel" inputMode="tel" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} error={errs.phone} />
            <Field id="email" label="Email" value={user.email} disabled hint="Your email is your login. Ask an admin to change it." />
            <div className="flex items-end"><Button type="submit" loading={busy === 'profile'}>Save profile</Button></div>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Appearance</h2>
          <p className="text-sm text-slate-500">Choose how CivicSync looks on this device.</p>
          <div className="mt-4 grid grid-cols-3 gap-3" role="group" aria-label="Theme">
            {THEMES.map((t) => (
              <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}
                className={`rounded-2xl border-2 p-2 text-center text-sm font-semibold ${theme === t.id ? 'border-brand-600 text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                <span className={`mb-2 block h-16 rounded-xl p-2 ${t.preview}`}><span className={`block h-3 w-2/3 rounded ${t.bar} shadow-sm`} /></span>
                <span className="inline-flex items-center gap-1"><t.icon size={15} />{t.label}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Globe size={18} />Language</h2>
          <p className="text-sm text-slate-500">The Kannada interface arrives in the next update.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" aria-pressed="true" className="min-h-12 rounded-xl border-2 border-brand-600 text-sm font-semibold text-brand-700">English</button>
            <button type="button" disabled className="min-h-12 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-400">ಕನ್ನಡ (soon)</button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><KeyRound size={18} />Security</h2>
          {adminSide && (
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><ShieldCheck size={16} className="text-brand-600" />Two-factor codes protect admin accounts. A Super Admin can reset yours if you lose your phone.</p>
          )}
          <form onSubmit={savePassword} className="mt-4 grid gap-4 sm:grid-cols-3" noValidate>
            <Field id="cur" label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} error={errs.current} />
            <Field id="new" label="New password" type="password" autoComplete="new-password" maxLength={72} value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} error={errs.next} hint="8+ characters with upper, lower case and a number" />
            <Field id="conf" label="Confirm new password" type="password" autoComplete="new-password" maxLength={72} value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} error={errs.confirm} />
            <div className="sm:col-span-3"><Button type="submit" variant="outline" loading={busy === 'password'}>Change password</Button></div>
          </form>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-500">Lost a device? Sign out everywhere.</p>
            <Button variant="secondary" onClick={() => setConfirmAll(true)}>Sign out of all devices</Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">About</h2>
          <p className="mt-1 text-sm text-slate-500">CivicSync: public service platform with integrated community safety.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" to="/transparency">Public transparency</Button>
            <Button variant="ghost" to="/open-data">Open data</Button>
            <Button variant="danger" icon={LogOut} onClick={() => logout()} className="ml-auto">Log out</Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog open={confirmAll} danger busy={busy === 'all'} title="Sign out of all devices?" confirmLabel="Sign out everywhere"
        message="You will be signed out here too and must log in again everywhere." onCancel={() => setConfirmAll(false)} onConfirm={signOutEverywhere} />
      <Link to="/" className="sr-only">Home</Link>
    </div>
  );
}