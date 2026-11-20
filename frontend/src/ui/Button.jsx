import { Link } from 'react-router-dom';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
  outline: 'border border-brand-600 text-brand-700 hover:bg-brand-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

// Pass "to" to render a link that looks like a button
export default function Button({ variant = 'primary', icon: Icon, loading = false, to, className = '', children, ...rest }) {
  const cls = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-60 ${VARIANTS[variant]} ${className}`;
  const body = (
    <>
      {Icon && <Icon size={18} />}
      {loading ? 'Please wait…' : children}
    </>
  );
  return to ? (
    <Link to={to} className={cls} {...rest}>{body}</Link>
  ) : (
    <button type="button" className={cls} {...rest} disabled={loading || rest.disabled}>{body}</button>
  );
}