import { describe, it, expect } from "vitest";
import { cleanName } from "./leaderboard";
import { TROPHIES, weekId } from "./progress";

describe("weekId", () => {
  it("returns an ISO-8601 week string", () => {
    expect(weekId()).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("maps known dates to the correct ISO week", () => {
    const cases = [
      ["2026-01-01T00:00:00Z", "2026-W01"],
      ["2026-01-05T00:00:00Z", "2026-W02"],
      ["2024-01-01T00:00:00Z", "2024-W01"],
      ["2023-01-01T00:00:00Z", "2022-W52"],
      ["2021-01-01T00:00:00Z", "2020-W53"],
      ["2026-09-06T00:00:00Z", "2026-W36"],
    ] as const;
    for (const [iso, expected] of cases) {
      expect(weekId(new Date(iso))).toBe(expected);
    }
  });
});

describe("cleanName", () => {
  it("trims and collapses a plain name", () => {
    expect(cleanName("  bob smith  ")).toBe("bob smith");
  });

  it("falls back to PLAYER for an empty name", () => {
    expect(cleanName("   ")).toBe("PLAYER");
    expect(cleanName("")).toBe("PLAYER");
  });

  it("strips non-alphanumeric characters", () => {
    expect(cleanName("héllo")).toBe("hllo");
    expect(cleanName("Pe-pe")).toBe("Pe-pe");
  });

  it("caps the length at 12 characters", () => {
    expect(cleanName("a".repeat(30))).toHaveLength(12);
  });

  it("sanitises markup out of names", () => {
    expect(cleanName("><img src=x>")).toBe("img srcx");
  });
});

describe("trophy catalogue", () => {
  it("has unique ids", () => {
    const ids = TROPHIES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every game", () => {
    const games = new Set(TROPHIES.map((t) => t.game));
    expect(games).toContain("serpentine");
    expect(games).toContain("blocktwist");
    expect(games).toContain("breakout");
    expect(games).toContain("invaders");
    expect(games).toContain("pong");
    expect(games).toContain("asteroids");
    expect(games).toContain("sweeper");
    expect(games).toContain("memory");
  });
});