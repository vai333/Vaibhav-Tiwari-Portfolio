"use client";

import { useSyncExternalStore } from "react";
import { phases, site } from "@/lib/site";
import { phaseStore } from "@/lib/scroll";

export function Header() {
  const phase = useSyncExternalStore(phaseStore.subscribe, phaseStore.get, () => 0);

  const current = phases[phase];

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <a
          href="#top"
          className="rounded-full border border-white/15 bg-black/55 px-4 py-2 font-display text-base font-bold tracking-tight text-white backdrop-blur-md"
        >
          {site.name}
        </a>
        <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md sm:flex">
          <span className="font-display font-bold text-amber-300">{current.index}</span>
          <span className="text-white/40">/</span>
          <span className="font-display">06</span>
          <span className="ml-2 font-semibold">{current.title}</span>
        </div>
        <button
          type="button"
          onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
          className="rounded-full bg-amber-300 px-5 py-2 text-sm font-bold text-black transition hover:bg-amber-200"
        >
          Contact
        </button>
      </div>
      <div className="h-0.5 w-full bg-white/10">
        <div
          className="h-0.5 w-full origin-left bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400"
          style={{ transform: "scaleX(var(--progress, 0))" }}
        />
      </div>
    </header>
  );
}
