/** Lesson-mode skeleton: rail | top bar, stage and action bar, the same frame the lesson renders. */
export default function ClassViewerLoading() {
  const block = 'rounded-xl bg-muted motion-safe:animate-pulse'
  return (
    <div className="grid h-dvh grid-cols-1 md:grid-cols-[72px_minmax(0,1fr)]" aria-busy="true">
      <aside className="hidden flex-col items-center gap-3 border-r border-border bg-sunken py-3 md:flex">
        <div className={`${block} h-10 w-10`} />
        <div className={`${block} h-10 w-10 rounded-full`} />
        {Array.from({ length: 6 }, (_, i) => <div key={i} className={`${block} h-9 w-10 rounded-full`} />)}
      </aside>
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
        <div className="flex items-center gap-4 border-b border-border px-4 py-3 md:px-6">
          <div className="grid flex-1 gap-1.5">
            <div className={`${block} h-3 w-40`} />
            <div className={`${block} h-5 w-56`} />
          </div>
          <div className="hidden gap-2 md:flex">
            {Array.from({ length: 3 }, (_, i) => <div key={i} className={`${block} h-9 w-24`} />)}
          </div>
          <div className="flex flex-1 justify-end gap-2">
            <div className={`${block} h-9 w-9`} />
            <div className={`${block} h-9 w-9`} />
          </div>
        </div>
        <div className="p-4 md:px-8">
          <div className={`${block} h-full w-full rounded-2xl`} />
        </div>
        <div className="flex items-center gap-3 border-t-2 border-border px-4 py-3.5 md:px-6">
          <div className={`${block} h-11 w-11 rounded-full`} />
          <div className="grid flex-1 gap-1.5">
            <div className={`${block} h-4 w-44`} />
            <div className={`${block} h-3 w-60`} />
          </div>
          <div className={`${block} h-11 w-32 rounded-[14px]`} />
        </div>
      </div>
    </div>
  )
}
