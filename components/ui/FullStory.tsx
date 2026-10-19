import { phases } from "@/lib/site";

/** The whole narrative in one readable place, after the scroll story. */
export function FullStory() {
  return (
    <section id="journey" className="relative px-4 pt-24 md:px-16 md:pt-32">
      <div className="mx-auto max-w-6xl rounded-3xl border border-white/15 bg-black/75 p-6 text-white backdrop-blur-xl md:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">The story so far</p>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-6xl">Six chapters, one thread.</h2>
        <ol className="mt-10 grid gap-x-12 gap-y-10 md:mt-14 md:grid-cols-2">
          {phases.map((phase) => (
            <li key={phase.id} className="border-t border-white/15 pt-6">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                <span className="font-display text-amber-200">{phase.index}</span>
                <span className="h-px w-5 bg-amber-300/60" />
                <span>{phase.kicker}</span>
              </div>
              <h3 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">{phase.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed font-medium text-white/85 md:text-base">{phase.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
