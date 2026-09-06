import { weekId } from "./progress";

export interface BoardEntry {
  name: string;
  difficulty: string;
  score: number;
  ts: number;
  remote?: boolean;
}

interface LocalEntry extends BoardEntry {
  week: string;
}

const LOCAL_KEY = "serpentine.leaderboard";
const NAME_KEY = "serpentine.player";
const MAX_LOCAL = 200;
const BOARD_SIZE = 10;

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** The live Supabase board is enabled only when the exercise env vars are set. */
export const lbEnabled = Boolean(url && anon);

/**
 * Lazily acquired Supabase client. The heavy supabase-js bundle is only
 * fetched (via dynamic import) on the first remote leaderboard interaction,
 * so it never blocks initial paint.
 */
let clientPromise: Promise<import("@supabase/supabase-js").SupabaseClient | null> | null = null;
function getClient(): Promise<import("@supabase/supabase-js").SupabaseClient | null> {
  if (!lbEnabled) return Promise.resolve(null);
  clientPromise ??= import("@supabase/supabase-js")
    .then((m) => m.createClient(url as string, anon as string))
    .catch(() => null);
  return clientPromise;
}

function loadLocal(): LocalEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocal(rows: LocalEntry[]) {
  try {
    const slim = rows.slice(0, MAX_LOCAL);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(slim));
  } catch {
    /* storage full or unavailable */
  }
}

export function getPlayerName(): string {
  try {
    return (localStorage.getItem(NAME_KEY) ?? "").toString().slice(0, 12);
  } catch {
    return "";
  }
}

export function setPlayerName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name.slice(0, 12));
  } catch {
    /* ignore */
  }
}

export function cleanName(raw: string): string {
  const cleaned = raw.replace(/[^\w\s-]/g, "").trim().slice(0, 12);
  return cleaned || "PLAYER";
}

export interface FeedbackPayload {
  kind: "feedback" | "issue" | "crash";
  message: string;
  name?: string;
  game?: string;
}

/**
 * Persist feedback / bug / crash reports to the `feedback` table. A Supabase
 * database webhook forwards new rows to the `notify-slack` edge function.
 * Returns false when the global board is not configured so callers can fall
 * back to local-only UI. Never throws.
 */
export async function submitFeedback(f: FeedbackPayload): Promise<boolean> {
  const client = await getClient();
  if (!client) return false;
  const clean = f.name ? cleanName(f.name) : "";
  try {
    const { error } = await client.from("feedback").insert({
      type: f.kind,
      name: clean && clean !== "PLAYER" ? clean : null,
      message: (f.message || "").slice(0, 4000),
      game: f.game || null,
      url: typeof location !== "undefined" ? location.href.slice(0, 500) : null,
      meta: {},
    });
    return !error;
  } catch {
    return false;
  }
}

export async function submitScore(name: string, difficulty: string, score: number): Promise<void> {
  const entry: LocalEntry = { name: cleanName(name), difficulty, score, ts: Date.now(), week: weekId() };
  const rows = loadLocal();
  rows.push(entry);
  saveLocal(rows);

  const client = await getClient();
  if (!client) return;
  try {
    await client.from("scores").insert({ name: entry.name, difficulty, score, week: entry.week });
  } catch {
    /* offline or unreachable - local board still has the score */
  }
}

function dedupeMerge(entries: BoardEntry[], asc = false): BoardEntry[] {
  const seen = new Set<string>();
  const out: BoardEntry[] = [];
  const cmp = asc
    ? (a: BoardEntry, b: BoardEntry) => a.score - b.score || a.ts - b.ts
    : (a: BoardEntry, b: BoardEntry) => b.score - a.score || a.ts - b.ts;
  for (const e of [...entries].sort(cmp)) {
    const key = `${e.name}:${e.score}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= BOARD_SIZE) break;
  }
  return out;
}

export async function fetchBoard(difficulty: string, asc = false, week?: string): Promise<BoardEntry[]> {
  const local = loadLocal().filter((e) => e.difficulty === difficulty && (!week || e.week === week));
  const client = await getClient();
  if (!client) {
    return dedupeMerge(local.map((e) => ({ ...e, remote: false })), asc);
  }
  try {
    let query = client
      .from("scores")
      .select("name, score, created_at")
      .eq("difficulty", difficulty)
      .order("score", { ascending: asc })
      .limit(BOARD_SIZE);
    if (week) query = query.eq("week", week);
    const { data, error } = await query;
    if (error) throw error;
    const remote = ((data ?? []) as { name: string; score: number; created_at?: string }[]).map((r) => ({
      name: r.name,
      difficulty,
      score: r.score,
      ts: r.created_at ? new Date(r.created_at).getTime() : 0,
      remote: true,
    }));
    return dedupeMerge([...remote, ...local], asc);
  } catch {
    return dedupeMerge(local.map((e) => ({ ...e, remote: false })), asc);
  }
}