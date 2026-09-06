# Serpentine Arcade

An open-source, offline-first retro game store for TVs. Pick a game, plug in a
controller (or use the remote), play. No account, no ads, no tracking — just
arcade games designed for the couch.

**Play it live:** https://engida32.github.io/serpentine

## Games

| Game | Premise |
| --- | --- |
| **SERPENTINE** | Classic snake with 3 difficulties, bonus fruits and a cleared-board win. |
| **BLOCK TWIST** | 2048 with pixel-perfect slides, merges and a 2048 win state. |
| **NEON PONG** | First-to-7 duel against "The Ghost". |
| **BREAKOUT** | Clear a 5-row wall before your three balls run out. |
| **SPACE INVADERS** | Sweep the fleet, dodge their fire, defend the planet. |
| **ASTEROIDS** | Turn, thrust and split rocks in an endless belt. |
| **SWEEPER** | 9x9 minesweeper with a safe first sweep and a best clear time. |
| **MEMORY** | Flip 4x4 cards and clear the board in the fewest moves. |

Every game works with a TV remote, keyboard or a gamepad, and stays fully
offline.

## Everything runs on free

| Need | Free solution |
| --- | --- |
| Hosting | GitHub Pages |
| Game leaderboards | Supabase free tier (optional — falls back to local scores offline) |
| Fonts | Bundled locally as woff2 |
| Build/deploy | GitHub Actions (free for public repos) |
| Network | None required — the game is a PWA and works fully offline |

## Features

- **Offline-first PWA** — fonts, assets and a service worker are all bundled;
  open it once and it works on a TV with no internet.
- **TV & remote ready** — fullscreen display mode, keyboard, swipe and
  Gamepad API support (D-pad, sticks and face buttons).
- **Leaderboard** — per-game all-time **and weekly** rankings that work
  offline (localStorage) and sync to a Supabase-backed global board when
  configured.
- **Trophies** — 20 hidden achievements (board clears, streaks, speed runs,
  perfect games) tracked on-device and shown on the hub.
- **Score sharing** — one tap copies a shareable score line.
- **Open source** — adding a game is a one-file + one-line change
  (see [CONTRIBUTING.md](CONTRIBUTING.md)); contributors get a
  "made by @user" badge on their hub card.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # strict TypeScript
npm run build      # production build into dist/
```

## Enable the live leaderboard (optional, free)

1. Create a free project at [supabase.com](https://supabase.com).
2. Run this SQL in the SQL editor:

```sql
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  name text not null,
  difficulty text not null,
  score integer not null,
  week text,
  created_at timestamptz not null default now()
);

-- (no-op on fresh installs; adds the weekly filter column to existing tables)
alter table public.scores add column if not exists week text;

alter table public.scores enable row level security;

create policy if not exists "public read scores"
  on public.scores for select using (true);

create policy if not exists "public insert scores"
  on public.scores for insert with check (true);

create index if not exists scores_difficulty_score_idx
  on public.scores (difficulty, score desc);

create index if not exists scores_difficulty_week_idx
  on public.scores (difficulty, week);
```

3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Locally put them in a
   `.env` file; for the deployed site add them as repository **Actions
   secrets** on GitHub so the build receives them. Without these the game
   still works and keeps rankings on-device.

## Project structure

```
src/
  game/        # pure engines: engine.ts (snake), block.ts (2048), pong.ts
  games/       # one folder per game: GameDef registry + React shells
    index.ts   # the store registry — add new games here
    types.ts   # the GameDef contract every game implements
  ui/          # shared shell: controls, icons, fullscreen/gamepad hooks,
               # leaderboard modal, share button
  Arcade.tsx   # hub shell: header, fullscreen, mute, game navigation
```

Want to build your own game? See [CONTRIBUTING.md](CONTRIBUTING.md).

## Add a game

Create a `GameDef` in `src/games/` and register it in the store:

```tsx
import type { GameDef } from "./types";
import { IconGrid } from "../ui/icons";

export const myGame: GameDef = {
  id: "mygame",
  name: "MY GAME",
  tagline: "One-line pitch",
  accent: "text-lime",
  icon: <IconGrid />,
  by: "your-github-handle",               // optional: shows "made by @you" on the hub card
  readBest: () =>
    Number(localStorage.getItem("serpentine.mygame.best") ?? 0) || 0,
  render: (props) => <MyGame {...props} />,
};
```

Then in `src/games/index.ts`: `import { myGame } from "./myGame"` and add it to
the `GAMES` array. The hub, keyboard/gamepad navigation and trophy view all
pick it up automatically — make sure your game records its score through
`recordPlay()` and calls `unlockTrophy()` for any achievements (specs live in
`src/game/progress.ts`).

## License

[MIT](LICENSE) — build on it, fork it, publish your own collection.