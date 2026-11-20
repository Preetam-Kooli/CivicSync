import { useEffect, useState } from 'react';
import { Check, Copy, Mail, Send } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import { useToast } from '../../ui/toastContext.js';
import PageHeader from '../../shell/PageHeader.jsx';
import Button from '../../ui/Button.jsx';
import { Badge, Card, EmptyState, Segmented, Skeleton } from '../../ui/Surface.jsx';
import { MODULE_ICON } from '../../ui/moduleIcons.js';
import { DEPARTMENTS, ROLE_LABELS, deptLabel } from './constants.js';

const ROLES = [{ id: 'staff', title: 'Staff', desc: 'Handles and resolves issues' }, { id: 'admin', title: 'Admin', desc: 'Full access + announcements' }];
const TAB = {
  all: () => true,
  pending: (i) => i.status === 'pending',
  accepted: (i) => i.status === 'used',
  expired: (i) => ['expired', 'revoked'].includes(i.status),
};
const STATUS = { pending: ['amber', 'Pending'], used: ['green', 'Accepted'], expired: ['slate', 'Expired'], revoked: ['slate', 'Revoked'] };
const validEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());
const left = (iso) => { const h = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3.6e6)); return `${h}h left`; };

export default function InvitesPage() {
  const { session } = useAuth();
  const toast = useToast();
  const isSuper = session.user.role === 'super_admin';
  const [list, setList] = useState(null);
  const [tab, setTab] = useState('all');
  const [form, setForm] = useState({ role: 'staff', department: 'road', email: '', hours: '48' });
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!isSuper) return;
    let off = false;
    api('GET', '/api/admin/invites').then((d) => { if (!off) setList(d.invites); }).catch((e) => toast(e.message, 'error'));
    return () => { off = true; };
  }, [isSuper, key, toast]);

  if (!isSuper) return <Card><EmptyState title="Super Admins only">Only Super Admins can send invitations.</EmptyState></Card>;

  async function create(payload) {
    setBusy(true);
    setCopied(false);
    try {
      const d = await api('POST', '/api/admin/invites', payload);
      setLink({ url: `${window.location.origin}/accept-invite?token=${d.token}`, email: d.invite.email, hours: payload.hours });
      setForm((f) => ({ ...f, email: '' }));
      setKey((k) => k + 1);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const submit = (e) => {
    e.preventDefault();
    create({ email: form.email.trim(), role: form.role, hours: Number(form.hours), ...(form.role === 'staff' ? { department: form.department } : {}) });
  };

  async function copy() {
    try { await navigator.clipboard.writeText(link.url); setCopied(true); } catch { toast('Could not copy. Select the link and copy it by hand.', 'error'); }
  }
  const share = () => (navigator.share ? navigator.share({ title: 'CivicSync invitation', text: 'Your CivicSync invitation', url: link.url }).catch(() => {}) : copy());

  async function revoke(i) {
    try { await api('DELETE', `/api/admin/invites/${i.id}`); toast('Invitation revoked'); setKey((k) => k + 1); } catch (e) { toast(e.message, 'error'); }
  }

  const shown = (list ?? []).filter(TAB[tab]);
  const n = (t) => (list ?? []).filter(TAB[t]).length;

  return (
    <>
      <PageHeader title="Invitations" subtitle="Invite staff or admins with a secure, expiring link" />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <form onSubmit={submit} className="space-y-5" noValidate>
            <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Role</legend>
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map((r) => (
                  <button key={r.id} type="button" aria-pressed={form.role === r.id} onClick={() => setForm((f) => ({ ...f, role: r.id }))} className={`rounded-2xl border-2 p-3 text-left ${form.role === r.id ? 'border-brand-600 bg-brand-50' : 'border-slate-200'}`}>
                    <b className="block text-slate-900">{r.title}</b><span className="text-xs text-slate-500">{r.desc}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            {form.role === 'staff' && (
              <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Department</legend>
                <div className="flex flex-wrap gap-2">
                  {DEPARTMENTS.map((d) => { const Icon = MODULE_ICON[d.value]; return (
                    <button key={d.value} type="button" aria-pressed={form.department === d.value} onClick={() => setForm((f) => ({ ...f, department: d.value }))} className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold ${form.department === d.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 text-slate-600'}`}><Icon size={15} />{d.label}</button>
                  ); })}
                </div>
              </fieldset>
            )}
            <div>
              <label htmlFor="inv-email" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Email</label>
              <div className="relative"><Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input id="inv-email" type="email" inputMode="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@department.gov.in" className="min-h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 text-base outline-none focus:border-brand-600" />
                {validEmail(form.email) && <Check size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600" />}
              </div>
            </div>
            <div>
              <label htmlFor="inv-hours" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Link valid for</label>
              <select id="inv-hours" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option></select>
            </div>
            <Button type="submit" className="w-full" loading={busy} disabled={!validEmail(form.email)}>Create invitation link</Button>
          </form>
          {link && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Check size={16} />Link ready · valid {link.hours} hours. Shown only once.</p>
              <code className="mt-2 block break-all rounded-xl bg-white p-3 text-xs text-slate-700">{link.url}</code>
              <div className="mt-3 grid grid-cols-2 gap-3"><Button variant="secondary" icon={Copy} onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</Button><Button icon={Send} onClick={share}>Share</Button></div>
            </div>
          )}
        </Card>

        <div className="lg:col-span-3">
          <div className="mb-3"><Segmented label="Status" value={tab} onChange={setTab} options={[{ value: 'all', label: `All ${list ? n('all') : ''}` }, { value: 'pending', label: `Pending ${list ? n('pending') : ''}` }, { value: 'accepted', label: `Accepted ${list ? n('accepted') : ''}` }, { value: 'expired', label: `Expired ${list ? n('expired') : ''}` }]} /></div>
          {!list && <Skeleton className="h-40" />}
          {list && shown.length === 0 && <Card><EmptyState title="No invitations here">Create one on the left.</EmptyState></Card>}
          <ul className="space-y-3">
            {shown.map((i) => (
              <li key={i.id}>
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{i.email}</p><p className="text-sm text-slate-500">{ROLE_LABELS[i.role]}{i.department ? ` · ${deptLabel(i.department)}` : ''}{i.status === 'pending' ? ` · ${left(i.expiresAt)}` : ''}</p></div>
                  <Badge tone={STATUS[i.status][0]}>{STATUS[i.status][1]}</Badge>
                  {i.status === 'pending' && <Button variant="secondary" onClick={() => revoke(i)}>Revoke</Button>}
                  {['expired', 'revoked'].includes(i.status) && i.role !== 'super_admin' && <Button variant="outline" onClick={() => create({ email: i.email, role: i.role, hours: 48, ...(i.department ? { department: i.department } : {}) })}>Resend</Button>}
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}