import { useRef, useState } from "react";
import { copyShare, type SharePayload } from "../game/share";
import { sfx } from "../game/audio";
import { IconCheck, IconShare } from "./icons";

export function ShareButton({ payload, variant = "ghost" }: { payload: SharePayload; variant?: "ghost" | "primary" | "coral" }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  const doCopy = () => {
    sfx.unlock();
    sfx.select();
    void copyShare(payload).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    });
  };

  const styles = {
    ghost: "bg-moss text-foam border-[#08150e] hover:bg-fern",
    primary: "bg-lime text-ink border-[#557f22] hover:bg-[#baff75]",
    coral: "bg-coral text-ink border-[#8f231c] hover:bg-[#ff8478]",
  };

  return (
    <button
      type="button"
      title={copied ? "Copied!" : "Copy score to share"}
      onClick={doCopy}
      className={`font-display uppercase text-[9px] tv:text-sm inline-flex items-center justify-center gap-2 select-none px-3.5 py-2.5 rounded-md border-b-4 transition-all duration-100 active:translate-y-[3px] active:border-b-0 cursor-pointer ${styles[variant]}`}
    >
      {copied ? (
        <>
          <IconCheck /> Copied!
        </>
      ) : (
        <>
          <IconShare /> Share
        </>
      )}
    </button>
  );
}