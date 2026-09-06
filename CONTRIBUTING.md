# Contributing

Thanks for contributing to Serpentine Arcade! The store is designed so that
adding a new game is a small, isolated change — no plumbing required.

## Ways to contribute

- Add a new game (see below)
- Port an existing game to run on this store
- Improve accessibility, TV/remote handling or performance
- Report a bug or request a game in [Issues](../../issues)

## Adding a game

A game lives in two pieces:

1. **An engine** under `src/game/` — pure logic (state, moves, scoring,
   AI) with no React. Engines are plain classes/functions you can unit-test
   in Node. See `src/game/engine.ts`, `src/game/block.ts`, `src/game/pong.ts`.
2. **A React shell** under `src/games/` — the engine wired to canvas/DOM,
   input, HUD, overlays and sharing.

The shell exports a `GameDef` and is registered in `src/games/index.ts`:

```tsx
import type { GameDef } from "./types";

export const mygame: GameDef = {
  id: "mygame",                 // unique slug used as a hash route
  name: "MY GAME",              // display name (uppercase arcade style)
  tagline: "Short promise",     // shown on the hub card
  accent: "text-lime",          // tailwind text colour for the card
  icon: <MyGameIcon />,         // 16x16 svg, stroke currentColor
  readBest: () => myBest(),     // optional: shows BEST chip on the card
  render: ({ onFullscreen, ...rest }) => (
    <MyGame toggleFullscreen={onFullscreen} {...rest} />
  ),
};
```

Then add one line to the registry:

```ts
export const GAMES: GameDef[] = [serpentine, blocktwist, pong, mygame];
```

That's the whole contribution flow — the hub card, keyboard/gamepad
navigation and the sharing button all pick it up automatically.

### Game shell props

The shell receives:

```ts
export interface GameProps {
  muted: boolean;
  onMute: () => void;
  onExit: () => void;          // go back to the hub
  toggleFullscreen: () => void;
}
```

### Expectations for a store game

Every game should keep the TV promises:

- **Held input.** Keyboard keys, held gamepad values (axes/D-pad) and
  coarse-pointer "hold to move" buttons — a TV remote has no drag gestures.
- **M/F/Escape keys.** `M` mute, `F` fullscreen, `Escape`/Android TV back
  returns to the hub (see `presentNext`, `onExit` wiring in existing games).
- **Offline.** No CDN fonts, no external images; sounds come from the local
  `sfx` helper in `src/game/audio.ts`.
- **Audio unlock.** Call `sfx.unlock()` on the first pointer/key event
  (browsers block sound until then).
- **Resolution-independent.** Canvas engines scale to their container and
  call `resize(w, h, dpr)` from a `ResizeObserver`.

## Quality bar

```bash
npm run typecheck && npm run build
```

- Strict TypeScript, no `any` leaking into game shells.
- Engines should be testable headlessly — a fuzz/random-play test for your
  engine's core loop is appreciated (see `00-block` history for the pattern).
- Follow existing conventions: Tailwind utility classes, `bg-pit`/`text-mint`
  arcade tokens, `font-display` for headings, `keycap` for key hints.

## Opening a PR

1. Fork and branch from `master`.
2. Add your game (or fix) in one focused commit.
3. Push and open a PR. In the description, note the controls and any
   deliberate design choices.

## Supabase table changes

Leaderboard-only schema lives in the README's SQL block. If a game wants its
own table, keep RLS open-read / restrict-write (`insert` policy only) and
mirror the same `created_at`/score shape.