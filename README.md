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
- **Leaderboard** — per-game rankings that work offline (localStorage) and
  sync to a Supabase-backed global board when configured.
- **Score sharing** — one tap copies a shareable score line.
- **Open source** — adding a game is a one-file + one-line change
  (see [CONTRIBUTING.md](CONTRIBUTING.md)).

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
create table public.scores (
  id bigint generated always as identity primary key,
  name text not null,
  difficulty text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

alter table public.scores enable row level security;

create policy "public read scores"
  on public.scores for select using (true);

create policy "public insert scores"
  on public.scores for insert with check (true);

create index scores_difficulty_score_idx
  on public.scores (difficulty, score desc);
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

## License

[MIT](LICENSE) — build on it, fork it, publish your own collection.