# STAN-1 — Portfolio of Stan Theunissen

A personal portfolio styled as a **living component datasheet**: every section is a
datasheet chapter (General Description, Operating History, Application Circuits,
Pin Configuration, Electrical Interface), set on top of a **real simulated logic
circuit** rendered to a full-page canvas.

## The circuit background

`src/circuit/engine.ts` is a hand-written engine, not a particle effect:

- Procedurally generates a combinational network — sources → AND/OR/XOR/NAND/NOT
  gates → LEDs — with Manhattan-routed, corner-rounded traces.
- Simulates **true propagation**: signals travel along wires at a fixed px/s,
  gates evaluate after a gate delay, rising edges sweep orange with a bright
  comet head, falling edges drain the trace back to idle.
- Static geometry is pre-rendered to an offscreen canvas; each frame only paints
  live signal regions. DPR-aware, pauses when the tab is hidden, honours
  `prefers-reduced-motion`.
- Move your cursor near a source pad to poke it.

## Stack

- Vite + React + TypeScript
- [Motion](https://motion.dev) for choreographed reveals
- [Lenis](https://lenis.darkroom.engineering) for smooth scrolling
- Type: Instrument Serif · Instrument Sans · IBM Plex Mono

## Develop

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

The downloadable CV lives at `public/StanTheunissen-CV.pdf`; site copy/content is
centralised in `src/data/cv.ts`.
