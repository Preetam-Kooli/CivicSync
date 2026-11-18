import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { compressImage } from '../../lib/imageCompress.js';
import Field from '../../shared/Field.jsx';
import LocationPicker from '../../shared/LocationPicker.jsx';
import { MODULES } from '../../shared/mapConfig.js';
import { SEVERITY_LABELS } from '../../shared/issueUi.js';

const selectClass =
  'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200';

export default function ReportIssuePage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ categoryId: '', title: '', description: '', severity: 3 });
  const [location, setLocation] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api('GET', '/api/shared/categories')
      .then((d) => setCategories(d.categories.filter((c) => c.module !== 'public_service')))
      .catch((err) => setError(err.message));
  }, []);

  const preview = photo ? URL.createObjectURL(photo) : '';

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await compressImage(file));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');

    const problems = {};
    if (!form.categoryId) problems.categoryId = 'Choose what kind of problem this is';
    if (form.title.trim().length < 3) problems.title = 'Title must be at least 3 characters';
    if (!location) problems.location = 'Choose the location on the map';
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) return;

    const fd = new FormData();
    fd.append('categoryId', form.categoryId);
    fd.append('title', form.title);
    if (form.description) fd.append('description', form.description);
    fd.append('severity', String(form.severity));
    fd.append('latitude', String(location.lat));
    fd.append('longitude', String(location.lng));
    if (photo) fd.append('photo', photo);

    setBusy(true);
    try {
      setResult(await api('POST', '/api/citizen/issues', fd));
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

  if (result) {
    return (
      <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-emerald-700">
          {result.merged ? 'Added to an existing report' : 'Report submitted'}
        </h1>
        <p className="text-slate-700">
          {result.alreadyReported
            ? 'You have already reported this problem. Thank you.'
            : result.merged
              ? 'Someone already reported this problem here. Your report was added to it, which raises its priority.'
              : 'Thank you. The authorities can now see it, and you can follow its progress.'}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/citizen/reports" className="inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-4 font-medium text-white hover:bg-emerald-700">
            My reports
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setForm({ categoryId: '', title: '', description: '', severity: 3 });
              setLocation(null);
              setPhoto(null);
            }}
            className="min-h-11 rounded-lg border border-slate-300 px-4 hover:bg-slate-100"
          >
            Report another
          </button>
        </div>
      </section>
    );
  }

  const photoButton =
    'inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-4 text-base hover:bg-slate-50';

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm" noValidate>
      <h1 className="text-2xl font-semibold text-slate-800">Report an issue</h1>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-slate-700">
          What is the problem?
        </label>
        <select id="category" value={form.categoryId} onChange={set('categoryId')} className={selectClass}>
          <option value="">Choose…</option>
          {MODULES.filter((m) => m.id !== 'public_service').map((m) => (
            <optgroup key={m.id} label={m.label}>
              {categories
                .filter((c) => c.module === m.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        {fieldErrors.categoryId && <p className="mt-1 text-sm text-red-600">{fieldErrors.categoryId}</p>}
      </div>

      <Field id="title" label="Short title" type="text" maxLength={120} value={form.title} onChange={set('title')} error={fieldErrors.title} />

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Details (optional)
        </label>
        <textarea
          id="description"
          rows={3}
          maxLength={1000}
          value={form.description}
          onChange={set('description')}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700">How serious is it?</legend>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className={`flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-lg border text-center text-xs ${
                Number(form.severity) === n ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-800' : 'border-slate-300'
              }`}
            >
              <input type="radio" name="severity" value={n} checked={Number(form.severity) === n} onChange={set('severity')} className="sr-only" />
              <span className="text-base">{n}</span>
              {SEVERITY_LABELS[n]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="block text-sm font-medium text-slate-700">Photo (optional)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className={photoButton}>
            Take a photo
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="sr-only" />
          </label>
          <label className={photoButton}>
            Choose from gallery
            <input type="file" accept="image/*" onChange={handlePhoto} className="sr-only" />
          </label>
          {photo && (
            <button type="button" onClick={() => setPhoto(null)} className="min-h-11 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100">
              Remove
            </button>
          )}
        </div>
        {preview && (
          <img src={preview} alt="Preview of your photo" className="mt-3 max-h-48 rounded-lg border border-slate-200" />
        )}
      </div>

      <div>
        <p className="block text-sm font-medium text-slate-700">Where is it?</p>
        <div className="mt-2">
          <LocationPicker value={location} onChange={setLocation} />
        </div>
        {fieldErrors.location && <p className="mt-1 text-sm text-red-600">{fieldErrors.location}</p>}
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="min-h-11 w-full rounded-lg bg-emerald-600 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {busy ? 'Submitting…' : 'Submit report'}
      </button>
    </form>
  );
}