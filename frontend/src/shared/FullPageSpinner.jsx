export default function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
      <img src="/logo-mark.svg" alt="" width="64" height="64" className="animate-pulse" />
    </div>
  );
}