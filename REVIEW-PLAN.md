# Serpentine Arcade — Review Improvement Plan

Node-seeded on 2026-09-06. Each review item verified against the code; status is tracked here and updated as work lands.

Status legend: `[x]` done / verified · `[ ]` to do · `[~]` in progress

## Verification notes (review claims vs. reality)

| # | Review claim | Verified reality | Decision |
|---|---|---|---|
| 3 | `flipVertical` misnamed (breakout.ts:316) | TRUE — decides Y vs X reflection from penetration depth, no vertical flipping | Rename → `isVerticalReflection` |
| 4 | Invaders speed curve inverted | TRUE — `period = 420 + 720*(1.04 - alive/40)`: slows as fleet shrinks (450ms → 1131ms) | Invert to classic (speed up as fleet shrinks) + comment |
| 5 | Memory mismatch timeout lacks cleanup | FALSE — memory.tsx:71 clears the timer on unmount; `flip()` (line 102) also cancels a pending mismatch | No action |
| 8 | index.html title wrong | TRUE — `<title>Serpentine — Arcade Snake</title>` in the app shell | Retitle + meta description |
| 14 | Manifest display mode unverified | `display: "fullscreen"`, dark theme_color, 512 SVG icon — good for TV | Verified; optionally add PNG icons |

## Phase 1 — Production fixes (this pass)

- [ ] **P1-pause**: Add pause support to real-time engines — `phase: "paused"` + `togglePause()` on **Breakout, Pong, Invaders, Asteroids** (only Snake has it today; these four have none).
- [ ] **P1-pause-shell**: Wire pause into the four shells — `P` key, pause `IconBtn` in toolbar, PAUSED overlay (Resume / Restart / Quit + `P` hint), mirroring serpentine.tsx:306.
- [ ] **P1-flipVertical**: Rename `flipVertical` → `isVerticalReflection` in breakout.ts (update call site).
- [ ] **P1-invaders-curve**: Invert speed formula so invaders accelerate as `aliveCount()` shrinks; keep the `USING 1.04…` comment accurate.
- [ ] **P1-asteroids-spawn**: On death, re-roll the ship spawn to a rock-free position (margin = SHIP_R + rock.r + ~14) for up to N candidate points instead of always dead-center, keeping the 1600ms invuln window.
- [ ] **P1-leaderboard**: Add `LeaderboardModal` export to the 6 shells missing it (Pong, Breakout, Invaders, Asteroids, Sweeper, Memory) — trophy IconBtn + modal rendered like serpentine.tsx, so best tracking is surfaced consistently.
- [ ] **P1-meta**: Fix `index.html` title → "Serpentine Arcade" + description; regenerate built index via normal build.
- [ ] **P1-reduced-motion**: Central confetti helper (`gConfetti` in `src/ui/` or extend `src/game/share.ts`) that no-ops when `prefers-reduced-motion: reduce`; swap all 7 shell `canvas-confetti` call sites through it.
- [ ] **P1-reduced-motion-css**: Add `@media (prefers-reduced-motion: reduce)` block killing `animate-*` utilities in `src/index.css` (Tailwind v4).
- [ ] **P1-deps**: Remove unused deps — confirmed zero imports in `src/` for `@dnd-kit/*`, `recharts`, `date-fns`, `framer-motion`, `lucide-react`, `react-router-dom`, `uuid` (and `@types/uuid`). Verify with a final `rg`, `npm uninstall`, typecheck + build.
- [ ] **P1-pwa-icons**: Add `icons/icon-192.png` + `icons/icon-512.png` to the manifest so TV launchers/install prompt have raster icons (SVG-only can be flaky on some launchers).
- [ ] **P1-verify**: `npm run typecheck` + `BASE_PATH=/serpentine/ npm run build`; push; confirm deploy green + new bundle 200.

## Phase 2 — Deferred / optional

- [ ] **A2-engine-base**: Extract shared game-loop base (loop / destroy / resize / DPR) out of the 8 engine files' boilerplate.
- [ ] **B2-input-hook**: Single `useGameInput(config)` returning `{ held, touchX, setTouchX }` merging gamepad + keyboard + remote + pointer.
- [ ] **C2-pause-cc**: Cross-cutting pause — wrapper handles the pause signal and calls `engine.pause()/resume()` when present, no-op otherwise.
- [ ] **D2-audio-inject**: Optional injected audio callbacks instead of engines calling `sfx.*` directly.
- [ ] **G2-tetris**: New game (7-bag, hold, next preview, soft/hard drop, speed levels).
- [ ] **G2-whack**: Whac-a-Mole — single-button, 3×3/4×4, timer + score.
- [ ] **G2-more-arcade**: Flappy, Pinball, Breakout power-ups, Same Game/Peg solitaire, top-down racer, Dodge This.

## Notes kept from the review (informational)

- Tailwind v4: docs live at tailwindcss.com/docs/v4, not v3 — fine for this project.
- Framer-motion / recharts / dnd-kit / react-router / date-fns / uuid / lucide-react are all **actually unused** — the visual weight concern disappears once removed.
- Review items 5 (memory timeout) and 7 (leaderboard) — 5 is already handled in code; 7 needs the Phase 1 work above.