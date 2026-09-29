# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite + TypeScript without a UI framework, three.js for WebGL, GSAP for motion (GSAP was Stan's pick), and a small Node server (`node:http` + `node:sqlite`) for visits, guestbook and contact. It's deployed through Coolify behind Cloudflare in a brand-new repo. Reason: full control over one persistent WebGL layer, no framework runtime on the hot path, and a backend small enough to read in one sitting.

## Users

Everyone who lands from a CV, LinkedIn, a DM or X: recruiters and hiring managers, engineers at top tech companies, design-engineering studios, startups and founders, potential clients, the design and dev community, TU/e people, friends and family. They give it seconds. The site has to make them stop.

## Product Purpose

Pure flex. A personal site that proves Stan Theunissen is exceptionally skilled and has real potential, with the site itself as the evidence. Success means visitors are genuinely impressed, can't tell an AI made it, and become interested in what he builds. Primary action: email him.

## Positioning

Stan is a software engineer (and agentic-AI engineer) who builds whole systems himself: a personal AI agent with its own sandboxed VM and tooling, an AI job-outreach platform, autonomy software for a polar rover, multi-agent tutors, native Rust apps, infrastructure. The site runs real engineering (a live logic simulation that computes what you see) instead of decorating with it.

## Operating Context

Visitors are on laptops (MacBook-class, trackpad) and phones, usually arriving from a link and judging within five seconds. The theme follows the system, so light and dark are both first-class. For the next 12 months he's chasing software engineering internships, infrastructure/systems/DevOps work, and his own startup. Availability is shown prominently.

## Capabilities and Constraints

- English only. Web CV only, no PDF. Public contact details are email and links only: no phone, no address.
- Contact: email (primary), a contact form, LinkedIn, GitHub, X (handle still to confirm).
- Wanted: a command palette (⌘K), keyboard shortcuts, a few good easter eggs, a lab/playground, a guestbook, a visitor counter, a playable binary adder, and a circuit sandbox.
- Keep and rewrite the logic-gate simulation. Keep: real simulation, IEEE schematic symbols, calm pace, travelling signals. Change: it becomes the page's structure ("the circuit is the grid"), stays quiet until touched, reacts to cursor pokes, and computes the name on segment displays, the visitor counter and the adder.
- Motion: GSAP, one snap per section with native scrolling (no scroll-jacking), cinematic page transitions, no sound.
- WebGL is allowed with a fallback. Free fonts only. Self-hosted, privacy-friendly analytics. Solid accessibility basics. Mobile gets the same experience, adapted.
- Banned: pill tags, drop shadows, emoji, custom cursors, loading-percentage counters, scroll-jacking, a pulsing open-to-work dot, numbered section labels, italic serif accents, generic icons.
- Dropped concepts: the "Logic, all the way down" tagline and the STAN-1 chip-datasheet metaphor.

## Brand Commitments

- Name: Stan Theunissen.
- Label: Software engineer, with AI and agentic systems as the second line.
- Voice: dry and precise, bold and confident, almost wordless.
- Portrait: processed (1-bit / dithered), never a plain photo.
- Copy: Claude drafts, Stan edits.

## Evidence on Hand

- **Personal AI agent:** custom harness, its own sandboxed VM and tooling, does everything for him. Name and details still to confirm.
- **Hiriqa:** AI job-outreach platform. Next.js, Prisma, SQLite/Postgres, a five-worker agent pipeline (enrich, research, draft) streamed over SSE, an IMAP mailbox and threaded follow-ups. It started as Massa, a Tauri v2 + Rust desktop app. Source: `~/Developer/Projects/massa-web`, `massa`, `hiriqa-hero`.
- **Team Polar:** autonomy software for TU/e's autonomous polar rover. The repo is private and partly under NDA, so it's described at a high level only.
- **AICA-3:** multi-agent course tutor. Next.js + FastAPI + pgvector, with a supervisor plus knowledge, pedagogy, evaluation and effect agents. Parallel stages on Cerebras took a turn from about 40 s to about 8 s (per its README). github.com/ZiineZ/aica-3
- **gewis-rdp:** native macOS/Windows remote-desktop client for GEWIS. Tauri 2 + Rust, a custom FreeRDP build with Kerberos, VideoToolbox H.264 decode, and a direct path that skips the gateway on TU/e WiFi. github.com/ZiineZ/gewis-rdp
- **Seaside Technologies:** cinematic single-page company site (vinext + Paper Shaders).
- **City-mapping robot:** TU/e challenge-based learning project. ROS2, TurtleBot3, Gazebo, Unity.
- **Roles:** BSc Computer Science at TU/e (Sep 2024 to now, year 3). Technical infrastructure & IT at LIS, TU/e (May 2026 to now).
- **Media on hand:** screenshots, live URLs, source links.
- **Absent, don't invent:** X handle, the agent's name and specs, Polar dates and role title, project screenshots, and the "3 min → 10 s" speed-up claim (attribution unconfirmed).

## Product Principles

1. Proof over claims: the site runs real things (simulation, adder, counter) instead of listing skills.
2. Nothing decorative: every moving element is caused by something, whether a signal, an input or the visitor.
3. Few words, exact ones.
4. Performance is part of the flex. A janky frame is a failed claim.
5. The work leads and the chrome stays out of the way.

## Accessibility & Inclusion

Solid basics: semantic HTML, full keyboard navigation, a reduced-motion path that keeps all content, readable contrast for body text, and a 2D fallback when WebGL is unavailable.
