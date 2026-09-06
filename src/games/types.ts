import type { ReactNode } from "react";

/** Props every game receives from the arcade shell. */
export interface GameProps {
  muted: boolean;
  onMute: () => void;
  onExit: () => void;
  onFullscreen: () => void;
}

/**
 * A drop-in game definition. To add a game to the store:
 *
 *   1. Create `src/games/MyGame.tsx` exporting a `GameDef` (component + meta).
 *   2. Import it in `src/games/index.ts` and add it to the `GAMES` array.
 *
 * The hub, header badge and keyboard/gamepad navigation all render from this
 * registry, so a new game automatically appears in the store.
 */
export interface GameDef {
  id: string;
  name: string;
  tagline: string;
  /** Tailwind classes used by the hub card + header badge. */
  accent: string;
  icon: ReactNode;
  /** GitHub/username of the person who added the game ("made by @user"). */
  by?: string;
  /** Highest score read for the hub "BEST" chip. Returns 0 when unused. */
  readBest?: () => number;
  render: (props: GameProps) => ReactNode;
}