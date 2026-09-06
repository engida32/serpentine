import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface BoardEntry {
  name: string;
  difficulty: string;
  score: number;
  ts: number;
  remote?: boolean;
}

interface LocalEntry extends BoardEntry {}

const LOCAL_KEY = "serpentine.leaderboard";
const NAME_KEY = "serpentine.player";
const MAX_LOCAL = 200;
const BOARD_SIZE = 10;

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
let client: SupabaseClient | null = null;
if (url && anon) {
  try {
    client = createClient(url, anon);
  } catch {
    client = null;
  }
}

export const lbEnabled = client !== null;

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

export async function submitScore(name: string, difficulty: string, score: number): Promise<void> {
  const entry: LocalEntry = { name: cleanName(name), difficulty, score, ts: Date.now() };
  const rows = loadLocal();
  rows.push(entry);
  saveLocal(rows);

  if (!client) return;
  try {
    await client.from("scores").insert({ name: entry.name, difficulty, score });
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

export async function fetchBoard(difficulty: string, asc = false): Promise<BoardEntry[]> {
  const local = loadLocal().filter((e) => e.difficulty === difficulty);
  if (!client) {
    return dedupeMerge(local.map((e) => ({ ...e, remote: false })), asc);
  }
  try {
    const { data, error } = await client
      .from("scores")
      .select("name, score, created_at")
      .eq("difficulty", difficulty)
      .order("score", { ascending: asc })
      .limit(BOARD_SIZE);
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