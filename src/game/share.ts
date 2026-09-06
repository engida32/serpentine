export interface SharePayload {
  game: string; // e.g. "SERPENTINE" | "BLOCK TWIST"
  mode: string; // e.g. "ARCADE"
  score: number;
  extra?: string; // e.g. "board cleared" / tile reached
}

function baseUrl(): string {
  if (typeof location === "undefined") return "";
  return location.origin + location.pathname;
}

export function shareText(p: SharePayload): string {
  const parts = [`🐍 ${p.game} — I scored ${p.score}`];
  if (p.mode) parts.push(`on ${p.mode}`);
  if (p.extra) parts.push(` (${p.extra})`);
  parts.push(`Think you can beat it? ${baseUrl()}`);
  return parts.join(" ");
}

export async function copyShare(p: SharePayload): Promise<boolean> {
  const text = shareText(p);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}