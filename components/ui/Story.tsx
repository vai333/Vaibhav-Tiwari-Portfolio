import { phases, site, type Tag } from "@/lib/site";

type Phase = (typeof phases)[number];

/** Gold pill badge; ScrollDriver sets `data-on` when the scroll reaches its `at`. */
export function TagBadge({ tag }: { tag: Tag }) {
  return (
    <div
      data-tag
      data-at={tag.at}
      className="w-max max-w-full translate-y-3 scale-95 rounded-full border border-amber-200/35 bg-[#0c0a08]/75 py-2 pr-5 pl-2 text-white opacity-0 shadow-[0_0_40px_rgba(255,170,60,0.4)] blur-[3px] backdrop-blur-md transition duration-500 ease-out data-on:translate-y-0 data-on:scale-100 data-on:opacity-100 data-on:blur-none md:py-2.5 md:pl-2.5"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 px-1.5 font-display text-[11px] font-bold text-amber-950 md:h-10 md:min-w-10 md:text-sm">
          {tag.mark}
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300 md:text-xs">{tag.kicker}</div>
          <div className="font-display text-base leading-tight font-bold md:text-xl">{tag.title}</div>
        </div>
      </div>
    </div>
  );
}

function Chapter({ phase }: { phase: Phase }) {
  return (
    <div data-reveal className="invisible flex w-full max-w-md flex-col items-start gap-2.5 md:gap-3">
      <div className="rounded-2xl border border-amber-200/15 bg-[#0c0a08]/70 px-4 py-3 text-white backdrop-blur-md md:px-5 md:py-4">
        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300 md:text-xs">
          <span className="font-display text-amber-200">{phase.index}</span>
          <span className="h-px w-5 bg-amber-300/60" />
          <span>{phase.kicker}</span>
        </div>
        <h2 className="mt-1.5 font-display text-2xl leading-[1.05] font-bold tracking-tight md:text-4xl">{phase.title}</h2>
      </div>
      {phase.tags.map((tag) => (
        <TagBadge key={tag.kicker + tag.title} tag={tag} />
      ))}
    </div>
  );
}

/**
 * Six equal-height sections; the canvas maps their combined scroll range to 0 → 1, so each
 * section is exactly one sixth of the 3D timeline.
 */
export function Story() {
  return (
    <main id="story">
      {phases.map((phase, i) => (
        <section key={phase.id} id={phase.id} className="relative h-[230vh]">
          {i === 0 && (
            <div data-hero className="flex h-screen flex-col justify-end bg-[linear-gradient(to_top,rgba(2,3,8,0.85),rgba(2,3,8,0.4)_35%,transparent_60%)] px-6 pb-24 md:bg-[linear-gradient(to_top,rgba(2,3,8,0.55),transparent_45%)] md:px-16 md:pb-28">
              <p className="text-shadow-strong text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">Portfolio</p>
              <h1 className="text-shadow-strong mt-3 font-display text-5xl leading-[0.95] font-bold tracking-tight text-white md:text-8xl">
                {site.name}
              </h1>
              <p className="text-shadow-strong mt-4 max-w-xl text-base leading-relaxed font-medium text-white/90 md:mt-5 md:text-xl">
                From the stage and the running track to code, scale, AI and a company of my own. Scroll to follow the thread.
              </p>
              <div className="mt-10 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.25em] text-white/85">
                <span className="relative block h-9 w-5 rounded-full border-2 border-white/60">
                  <span className="absolute left-1/2 top-1.5 h-2 w-0.5 -translate-x-1/2 animate-bounce rounded-full bg-white" />
                </span>
                Scroll
              </div>
            </div>
          )}
          <div className={i === 0 ? "h-[130vh]" : "h-full"}>
            <div className="sticky top-0 flex h-screen items-end px-3 pb-6 md:items-center md:px-16 md:pb-0">
              <Chapter phase={phase} />
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}
