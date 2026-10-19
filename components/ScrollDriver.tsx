"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { PHASE_COUNT, phaseStore, scroll } from "@/lib/scroll";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Ties the 3D scene to the story: a scrubbed tween writes 0 → 1 into the shared scroll store,
 * which the R3F render loop reads every frame. Also reveals each section's card.
 */
export function ScrollDriver() {
  useGSAP(() => {
    const story = document.getElementById("story");
    if (!story) return;
    const root = document.documentElement;

    gsap.to(scroll, {
      progress: 1,
      ease: "none",
      scrollTrigger: {
        trigger: story,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.8,
        onUpdate: (self) => {
          root.style.setProperty("--progress", self.progress.toFixed(4));
          phaseStore.set(Math.min(PHASE_COUNT - 1, Math.floor(self.progress * PHASE_COUNT)));
        },
      },
    });

    gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((card) => {
      // Tags pop in one by one as the chapter scrolls past (each at its own fraction of the window).
      const tags = Array.from(card.querySelectorAll<HTMLElement>("[data-tag]"));
      const showTags = (progress: number) => tags.forEach((tag) => tag.toggleAttribute("data-on", progress >= Number(tag.dataset.at)));
      gsap.fromTo(
        card,
        { autoAlpha: 0, y: 40, filter: "blur(6px)" },
        {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.9,
          ease: "power3.out",
          // The sticky wrapper's parent spans the card's scroll range (after the hero in section 1).
          scrollTrigger: {
            trigger: card.parentElement?.parentElement ?? card,
            start: "top 25%",
            end: "bottom 60%",
            toggleActions: "play reverse play reverse",
            onUpdate: (self) => showTags(self.progress),
            onLeaveBack: () => showTags(-1),
          },
        },
      );
    });

    gsap.to("[data-hero]", {
      autoAlpha: 0,
      y: -60,
      ease: "none",
      scrollTrigger: { trigger: story, start: "top top", end: "+=60%", scrub: true },
    });
  });

  return null;
}
