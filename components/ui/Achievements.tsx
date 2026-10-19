"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { achievements, chapterNames, phases } from "@/lib/site";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// `t` runs along the timeline (percent of the plot), kept off the axes at both ends.
const points = achievements.map((a, i) => ({ ...a, t: 4 + (i / (achievements.length - 1)) * 90 }));
// Each chapter's axis label sits beside the middle of its points; dashed dividers fall between chapters.
const chapters = chapterNames.map((name, c) => {
  const ts = points.filter((p) => p.chapter === c).map((p) => p.t);
  return { name, index: phases[c].index, t: (Math.min(...ts) + Math.max(...ts)) / 2 };
});
const dividers = points.slice(1).flatMap((p, i) => (p.chapter !== points[i].chapter ? [(p.t + points[i].t) / 2] : []));

/**
 * One rising line through every achievement. Landscape: chapters along x, momentum up y. On phones the
 * same graph turns on its side (chapters run down, momentum to the right) so every label fits.
 */
function Chart({ vertical, className }: { vertical: boolean; className: string }) {
  const root = useRef<HTMLDivElement>(null);
  // Plot coordinates in percent: [left, top].
  const at = (t: number, y: number): [number, number] => (vertical ? [(y - 12) * 0.9, t] : [t, 100 - y]);
  const xy = points.map((p) => at(p.t, p.y));
  const line = xy.map(([x, y]) => `${x},${y}`).join(" ");
  const first = xy[0];
  const last = xy[xy.length - 1];
  const area = vertical ? `0,${first[1]} ${line} 0,${last[1]}` : `${first[0]},100 ${line} ${last[0]},100`;

  useGSAP(
    () => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root.current, start: "top 85%", end: vertical ? "bottom 85%" : "bottom 95%", scrub: 0.6 },
      });
      const hidden = vertical ? "inset(0% 0% 100% 0%)" : "inset(0% 100% 0% 0%)";
      tl.fromTo("[data-line]", { clipPath: hidden }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none", duration: 1 }, 0);
      gsap.utils.toArray<HTMLElement>("[data-point]").forEach((el) => {
        tl.fromTo(el, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.06, ease: "back.out(2)" }, Number(el.dataset.t) / 100 - 0.03);
      });
    },
    { scope: root },
  );

  // Landscape labels alternate above/below. Vertical: low-momentum points label to the right (above
  // the outgoing line), high ones to the left (below the incoming line), so labels never cross it.
  const labelClass = (i: number, y: number) =>
    vertical
      ? y > 75
        ? "right-3 top-1 text-right"
        : "left-3 bottom-1 text-left"
      : `left-0 -translate-x-1/2 text-center ${i % 2 === 0 ? "bottom-4" : "top-4"}`;

  return (
    <div ref={root} className={`relative ${vertical ? "h-[760px]" : "h-[500px]"} ${className}`}>
      {/* Axis titles */}
      {vertical ? (
        <>
          <div className="absolute top-0 right-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Momentum →</div>
          <div className="absolute top-0 left-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Chapters ↓</div>
        </>
      ) : (
        <>
          <div className="absolute top-1/2 left-0 -translate-x-1/3 -translate-y-1/2 -rotate-90 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
            Momentum
          </div>
          <div className="absolute right-0 bottom-0 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Chapters →</div>
        </>
      )}

      <div className={`absolute ${vertical ? "top-10 right-2 bottom-4 left-[84px]" : "top-14 right-14 bottom-20 left-10"}`}>
        {/* Grid and axes */}
        {[25, 50, 75].map((g) => (
          <div
            key={g}
            className={`absolute border-dashed border-white/10 ${vertical ? "inset-y-0 border-l" : "inset-x-0 border-t"}`}
            style={vertical ? { left: `${g}%` } : { top: `${g}%` }}
          />
        ))}
        {dividers.map((d) => (
          <div
            key={d}
            className={`absolute border-dashed border-amber-200/10 ${vertical ? "inset-x-0 border-t" : "inset-y-0 border-l"}`}
            style={vertical ? { top: `${d}%` } : { left: `${d}%` }}
          />
        ))}
        <div className="absolute inset-y-0 left-0 w-0.5 bg-white/50" />
        {vertical ? (
          <>
            <div className="absolute inset-x-0 top-0 h-0.5 bg-white/50" />
            <div className="absolute -bottom-1.5 -left-[5px] h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-white/50" />
            <div className="absolute -top-[5px] -right-1.5 h-0 w-0 border-y-[6px] border-l-[8px] border-y-transparent border-l-white/50" />
          </>
        ) : (
          <>
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/50" />
            <div className="absolute -top-1.5 -left-[5px] h-0 w-0 border-x-[6px] border-b-[8px] border-x-transparent border-b-white/50" />
            <div className="absolute -right-1.5 -bottom-[5px] h-0 w-0 border-y-[6px] border-l-[8px] border-y-transparent border-l-white/50" />
          </>
        )}

        {/* The line and the glow under it */}
        <svg data-line viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id={`ach-fill-${vertical}`} x1="0" y1="0" x2={vertical ? 1 : 0} y2={vertical ? 0 : 1}>
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={vertical ? 0 : 0.35} />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity={vertical ? 0.3 : 0} />
            </linearGradient>
            <linearGradient id={`ach-stroke-${vertical}`} x1="0" y1="0" x2={vertical ? 0 : 1} y2={vertical ? 1 : 0}>
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#ach-fill-${vertical})`} />
          <polyline
            points={line}
            fill="none"
            stroke={`url(#ach-stroke-${vertical})`}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: "drop-shadow(0 0 6px rgba(251,191,36,0.7))" }}
          />
        </svg>

        {/* Achievement points */}
        {points.map((p, i) => (
          <div key={p.title} data-point data-t={p.t} className="absolute" style={{ left: `${xy[i][0]}%`, top: `${xy[i][1]}%` }}>
            {p.win ? (
              <span className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 text-xs text-amber-950 shadow-[0_0_18px_rgba(251,191,36,0.9)]">
                ★
              </span>
            ) : (
              <span className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-200 bg-[#0c0a08] shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
            )}
            <div className={`absolute rounded-lg bg-black/60 px-2 py-1 whitespace-nowrap ${labelClass(i, p.y)}`}>
              <div className="font-display text-[13px] leading-tight font-bold md:text-sm">{p.title}</div>
              <div className="text-[11px] leading-tight font-medium text-white/65">{p.detail}</div>
            </div>
          </div>
        ))}

        {/* Chapter labels along the timeline axis */}
        {chapters.map((c) => (
          <div
            key={c.name}
            className={`absolute ${vertical ? "right-full mr-3 -translate-y-1/2 text-right" : "top-full mt-3 -translate-x-1/2 text-center"}`}
            style={vertical ? { top: `${c.t}%` } : { left: `${c.t}%` }}
          >
            <div className="font-display text-xs font-bold text-amber-300">{c.index}</div>
            <div className="text-xs font-semibold whitespace-nowrap text-white/80">{c.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Achievements() {
  return (
    <section id="achievements" className="relative px-4 pt-10 md:px-16 md:pt-16">
      <div className="mx-auto max-w-6xl rounded-3xl border border-white/15 bg-black/75 p-6 text-white backdrop-blur-xl md:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">Achievements</p>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-6xl">The climb, plotted.</h2>
        <Chart vertical className="mt-8 md:hidden" />
        <Chart vertical={false} className="mt-12 hidden md:block" />
      </div>
    </section>
  );
}
