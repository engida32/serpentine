import type { GameDef } from "./types";
import { serpentine } from "./serpentine";
import { blocktwist } from "./blocktwist";
import { breakout } from "./breakout";
import { invaders } from "./invaders";
import { asteroids } from "./asteroids";
import { sweeper } from "./sweeper";
import { memory } from "./memory";

/**
 * The game store registry. Add a new entry here (and a file in src/games)
 * to publish a game to the hub. That's the whole contribution flow.
 */
export const GAMES: GameDef[] = [serpentine, blocktwist, breakout, invaders, asteroids, sweeper, memory];

export type { GameDef, GameProps } from "./types";