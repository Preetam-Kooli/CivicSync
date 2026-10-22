export default function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
      <div className="size-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
    </div>
  );
}