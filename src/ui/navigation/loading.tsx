import { Skeleton, Spinner } from "@/ui/primitives";

export function PageLoading() {
  return (
    <main className="min-h-screen bg-cream-50 text-ink-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="container-page flex min-h-screen items-center justify-center py-16">
        <div className="surface-subtle w-full max-w-2xl rounded-2xl p-8">
          <div className="flex items-center gap-3">
            <Spinner className="h-5 w-5 text-accent-500 dark:text-accent-300" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="mt-8 grid gap-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  );
}

export function ConsolePageLoading() {
  return (
    <div className="container-page space-y-8 py-8">
      <header className="space-y-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="surface-elevated rounded-xl p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-16" />
          </div>
        ))}
      </section>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="surface-elevated rounded-xl p-5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-3 h-4 w-48 max-w-full" />
            <Skeleton className="mt-6 h-16 w-full rounded-lg" />
          </div>
        ))}
      </section>
    </div>
  );
}

export function AuthPageLoading() {
  return (
    <div className="surface-subtle w-full max-w-sm rounded-2xl p-6">
      <div className="flex items-center gap-3">
        <Spinner className="h-5 w-5 text-accent-500 dark:text-accent-300" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="mt-8 space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function DocsPageLoading() {
  return (
    <main className="min-h-screen bg-cream-50 text-ink-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="container-page py-12">
        <div className="max-w-3xl space-y-4">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="surface-elevated rounded-xl p-5">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}