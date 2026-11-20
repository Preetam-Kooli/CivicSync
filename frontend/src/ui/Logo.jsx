// Your official mark + the wordmark as real text (crisp, translatable, accessible)
export default function Logo({ stacked = false, dark = false, size, subtitle }) {
  const px = size ?? (stacked ? 76 : 36);
  return (
    <span className={`inline-flex items-center gap-2.5 ${stacked ? 'flex-col text-center' : ''}`}>
      <img src="/logo-mark.svg" alt="" width={px} height={px} className="shrink-0" />
      <span className="leading-tight">
        <span className={`block font-bold tracking-tight ${stacked ? 'text-3xl' : 'text-lg'} ${dark ? 'text-white' : 'text-[#15223f] dark:text-white'}`}>
          CivicSync
        </span>
        {subtitle && <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">{subtitle}</span>}
      </span>
    </span>
  );
}