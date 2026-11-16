// One labelled input with its error message. 16px text (text-base) keeps
// iPhones from zooming in on focus, and min-h-11 gives a 44px tap target.
export default function Field({ id, label, error, hint, ...inputProps }) {
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