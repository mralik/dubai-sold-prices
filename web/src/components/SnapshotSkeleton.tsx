export function SnapshotSkeleton() {
  return (
    <section className="card overflow-hidden p-5 sm:p-6" aria-busy="true" aria-label="Loading Dubai this month">
      <div className="h-7 w-48 animate-pulse rounded-lg bg-line/10" />
      <div className="mt-2 h-4 w-64 max-w-full animate-pulse rounded bg-line/10" />
      <div className="mt-5 grid gap-4">
        {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-line/10" />)}
      </div>
    </section>
  );
}
