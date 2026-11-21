import { useEffect, useState } from 'react';
import { CloudRain, MapPin } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import { useToast } from '../../ui/toastContext.js';
import PageHeader from '../../shell/PageHeader.jsx';
import Button from '../../ui/Button.jsx';
import { Badge, Card, EmptyState, Segmented } from '../../ui/Surface.jsx';
import Field from '../../shared/Field.jsx';
import LocationPicker from '../../shared/LocationPicker.jsx';
import { formatDateTime } from '../../shared/issueUi.js';

const PRESETS = [
  { label: 'Road closed', kind: 'road_closure', severity: 'warning', title: 'Road closed today', message: 'This road is closed. Please use the alternative route.' },
  { label: 'Fire', kind: 'fire', severity: 'critical', title: 'Fire reported', message: 'Fire services are on the way. Keep the area clear and avoid the roads nearby.' },
  { label: 'Waterlogging', kind: 'flood', severity: 'warning', title: 'Waterlogging on the road', message: 'Water has collected here. Avoid this stretch and drive slowly.' },
  { label: 'Power cut', kind: 'general', severity: 'info', title: 'Planned power cut', message: 'Electricity will be off for maintenance in this area.' },
];
const KINDS = [['general', 'General notice'], ['road_closure', 'Road closure'], ['fire', 'Fire'], ['flood', 'Flood'], ['weather', 'Weather']];
const SEVERITY = { info: ['blue', 'Information'], warning: ['amber', 'Warning'], critical: ['red', 'Critical'] };
const RADII = [100, 250, 500, 1000, 2000, 5000];
const ZONE_TONE = { normal: 'blue', watch: 'amber', high: 'red' };
const input = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-brand-600';
const EMPTY = { kind: 'general', severity: 'warning', title: '', message: '', hours: '6', where: 'all', place: '', radius: '500' };

const stateOf = (a) => (a.withdrawnAt ? 'withdrawn' : new Date(a.expiresAt) <= new Date() ? 'expired' : 'live');

export default function AlertsPage() {
  const { session } = useAuth();
  const toast = useToast();
  const allowed = session.user.role !== 'staff';
  const [alerts, setAlerts] = useState(null);
  const [zones, setZones] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [pin, setPin] = useState(null);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let off = false;
    Promise.all([api('GET', '/api/admin/alerts'), api('GET', '/api/admin/flood-zones')])
      .then(([a, z]) => { if (!off) { setAlerts(a.alerts); setZones(z.zones); } })
      .catch((e) => toast(e.message, 'error'));
    return () => { off = true; };
  }, [allowed, key, toast]);

  if (!allowed) return <Card><EmptyState title="Admins only">Only Admins and Super Admins can post announcements.</EmptyState></Card>;

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  async function post(e) {
    e.preventDefault();
    setErrs({});
    const body = { kind: form.kind, severity: form.severity, title: form.title, message: form.message, hours: Number(form.hours) };
    if (form.where === 'place') {
      if (!form.place.trim() && !pin) return setErrs({ location: 'Type the place name or drop a pin on the map' });
      if (form.place.trim()) body.locationName = form.place.trim();
      if (pin) Object.assign(body, { latitude: pin.lat, longitude: pin.lng, radiusM: Number(form.radius) });
    }
    setBusy(true);
    try {
      await api('POST', '/api/admin/alerts', body);
      toast('Announcement posted. It shows on every page within a minute.');
      setForm(EMPTY);
      setPin(null);
      setKey((k) => k + 1);
    } catch (err) {
      setErrs(Object.fromEntries((err.errors || []).map((x) => [x.field, x.message])));
      if (!err.errors) toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(a) {
    if (!window.confirm(`Withdraw "${a.title}"?`)) return;
    try { await api('POST', `/api/admin/alerts/${a.id}/withdraw`); toast('Announcement withdrawn'); setKey((k) => k + 1); } catch (err) { toast(err.message, 'error'); }
  }

  async function checkNow() {
    setBusy(true);
    try {
      const d = await api('POST', '/api/admin/weather/check');
      toast(`Checked ${d.summary.checked} of ${d.summary.zones} zones. ${d.summary.alerting} need attention.`);
      setKey((k) => k + 1);
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Announcements" subtitle="Post urgent notices for everyone, or for one place" />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="font-semibold text-slate-900">New announcement</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => setForm((f) => ({ ...f, kind: p.kind, severity: p.severity, title: p.title, message: p.message }))}
                className="min-h-11 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">{p.label}</button>
            ))}
          </div>

          <form onSubmit={post} className="mt-4 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label htmlFor="kind" className="mb-1 block text-sm font-medium text-slate-700">Type</label>
                <select id="kind" value={form.kind} onChange={set('kind')} className={input}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><label htmlFor="sev" className="mb-1 block text-sm font-medium text-slate-700">How urgent?</label>
                <select id="sev" value={form.severity} onChange={set('severity')} className={input}><option value="info">Information</option><option value="warning">Warning</option><option value="critical">Critical (cannot be dismissed)</option></select></div>
              <div><label htmlFor="hours" className="mb-1 block text-sm font-medium text-slate-700">Show for</label>
                <select id="hours" value={form.hours} onChange={set('hours')} className={input}>{[1, 3, 6, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} hour{h === 1 ? '' : 's'}</option>)}</select></div>
            </div>
            <Field id="title" label="Headline" maxLength={120} value={form.title} onChange={set('title')} error={errs.title} />
            <div>
              <label htmlFor="message" className="mb-1 block text-sm font-medium text-slate-700">What should people do?</label>
              <textarea id="message" rows={3} maxLength={500} value={form.message} onChange={set('message')} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-brand-600" />
              {errs.message && <p className="mt-1 text-sm text-red-600">{errs.message}</p>}
            </div>

            <fieldset className="rounded-2xl border border-slate-200 p-4">
              <legend className="flex items-center gap-1 px-2 text-sm font-semibold text-slate-700"><MapPin size={15} />Location</legend>
              <Segmented label="Where does this apply?" value={form.where} onChange={(v) => setForm((f) => ({ ...f, where: v }))} options={[{ value: 'all', label: 'Whole area' }, { value: 'place', label: 'A specific place' }]} />
              {form.where === 'place' && (
                <div className="mt-4 space-y-4">
                  <Field id="place" label="Place name" placeholder="e.g. Station Road, Ward 2" maxLength={120} value={form.place} onChange={set('place')} error={errs.locationName} />
                  <div>
                    <p className="mb-1 text-sm font-medium text-slate-700">Drop a pin on the map (optional, it also shows on the issue map)</p>
                    <LocationPicker value={pin} onChange={setPin} />
                  </div>
                  {pin && (
                    <div><label htmlFor="radius" className="mb-1 block text-sm font-medium text-slate-700">Affected radius</label>
                      <select id="radius" value={form.radius} onChange={set('radius')} className={input}>{RADII.map((r) => <option key={r} value={r}>{r >= 1000 ? `${r / 1000} km` : `${r} m`}</option>)}</select></div>
                  )}
                  {(errs.location || errs.latitude || errs.radiusM) && <p className="text-sm text-red-600">{errs.location || errs.latitude || errs.radiusM}</p>}
                </div>
              )}
            </fieldset>
            <Button type="submit" loading={busy}>Post announcement</Button>
          </form>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><CloudRain size={18} />Flood zones</h2><Button variant="secondary" onClick={checkNow} disabled={busy}>Check weather</Button></div>
            <p className="mt-1 text-xs text-slate-500">Checked every 30 minutes. An automatic announcement appears at watch or high.</p>
            <ul className="mt-3 space-y-2">
              {zones?.map((z) => (
                <li key={z.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                  <div className="min-w-0"><p className="truncate font-medium text-slate-900">{z.name}</p><p className="text-xs text-slate-500">watch {z.watchMm} · high {z.highMm} mm · forecast {z.forecastMm ?? '—'} mm</p></div>
                  <Badge tone={ZONE_TONE[z.status]}>{z.status}</Badge>
                </li>
              ))}
              {zones?.length === 0 && <li className="text-sm text-slate-500">No flood zones yet.</li>}
            </ul>
          </Card>
        </div>
      </div>

      <h2 className="mb-3 mt-7 font-semibold text-slate-900">Recent announcements</h2>
      {alerts?.length === 0 && <Card><EmptyState title="Nothing posted yet">Announcements appear here.</EmptyState></Card>}
      <ul className="space-y-3">
        {alerts?.map((a) => {
          const state = stateOf(a);
          return (
            <li key={a.id}>
              <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{a.title}</p>
                  <p className="text-sm text-slate-600">{a.message}</p>
                  {a.locationName && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand-700"><MapPin size={13} />{a.locationName}{a.hasArea ? ` · ${a.radiusM >= 1000 ? `${a.radiusM / 1000} km` : `${a.radiusM} m`} area on the map` : ''}</p>}
                  <p className="mt-1 text-xs text-slate-400">{a.source === 'weather' ? 'Automatic (weather)' : `Posted by ${a.postedBy || 'an admin'}`} · until {formatDateTime(a.expiresAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={SEVERITY[a.severity][0]}>{SEVERITY[a.severity][1]}</Badge>
                  <Badge>{state}</Badge>
                  {state === 'live' && <Button variant="secondary" onClick={() => withdraw(a)}>Withdraw</Button>}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}