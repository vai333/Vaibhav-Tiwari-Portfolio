# Vaibhav Tiwari: 3D Scroll Portfolio

**Live:** https://vaibhav-tiwari-portfolio.vercel.app

An interactive, scroll-driven 3D portfolio that tells my story as a single continuous journey. Instead of
a page of sections, you scroll through a WebGL world in a gold-on-black style: each chapter of my life
becomes a scene, and particles, geometry and camera all move from one chapter to the next.

## The story

| # | Chapter | What it shows |
|---|---------|---------------|
| 01 | **The Early Drive** | A golden light tornado turns into a voice waveform and then a running track: public speaking, long jump, Head Boy. |
| 02 | **The Algorithmic Crucible** | A 3D analytic chart whose bars replay a real insertion sort: 500+ DSA problems, 300+ on LeetCode, 4★ on CodeChef. |
| 03 | **The Foundation** | A blueprint draws itself and a gold pillar rises under a beam of light: TechInnovation winner. |
| 04 | **The Scale** | The blueprint extrudes into a city at golden hour with glass and stone towers along a sunlit avenue: corporate backends at Infosys (ACC) with Java, Spring Boot and PostgreSQL. |
| 05 | **The Pivot to AI & Product** | The city melts into a glowing neural core above a sea of storm clouds: EZY SIGNAL, Skillathon winner. |
| 06 | **The Entrepreneurial Leap** | Sunrise over a city seen from a rooftop, with a live revenue dashboard: HONEST SWEET (₹2L+ in its first 4 weeks) and Mesa School of Business. |

Gold tags appear for each achievement as you scroll. The full written story, an achievements line
graph and contact links come after the 3D journey.

## Stack

Next.js 16 (App Router) · React 19 · React Three Fiber 9 · drei · @react-three/postprocessing ·
GSAP ScrollTrigger · Tailwind CSS 4 · deployed on Vercel

## Run locally

```bash
npm install
npm run dev
```

No environment variables are needed. Deploy with `npx vercel deploy --prod`.

## How it works

- `lib/scroll.ts`: holds a mutable `scroll.progress` that runs from 0 to 1. `components/ScrollDriver.tsx` writes it with a scrubbed GSAP
  ScrollTrigger tween over `#story`, and every R3F component reads it in `useFrame`, so scrolling causes no React re-renders.
- `lib/layouts.ts`: seeded, deterministic layouts for the track, plot, city, skyline, neural web and rooftop city. The phase
  meshes and the particle field share them, so particles land exactly on the geometry they become.
- `components/canvas/Flow.tsx`: a single `Points` draw call that holds 8 formations in vertex attributes. The shader morphs
  between formations, staggering each particle.
- `components/canvas/CameraRig.tsx`: a Catmull-Rom camera path through keyframes. It is smoothed with `lerp`, its FOV is keyed per phase,
  and the FOV widens on narrow screens.
- `components/canvas/phases/*`: one component per chapter, each mounted lazily one phase ahead of the reader. The city
  and sky use custom shaders: world-space window facades, street markings, sky reflections and a golden-hour sky dome.
- `components/canvas/Atmosphere.tsx`: background, fog, environment intensity and accent lights for each phase.
- `lib/quality.ts`: a device heuristic that gives phones fewer particles, a lower pixel ratio and smaller shadow maps.

## Personal details

Edit `lib/site.ts` to change the name, email, social links (an empty link hides its icon), each chapter's tags and
copy, and the points on the achievements graph.
