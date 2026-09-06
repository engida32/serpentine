import { sfx } from "../game/audio";

export function ArcadeButton({
  children,
  onClick,
  variant = "ghost",
  big = false,
  disabled = false,
  title,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost" | "gold" | "coral";
  big?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-lime text-ink border-[#557f22] hover:bg-[#baff75]",
    gold: "bg-gold text-ink border-[#96700f] hover:bg-[#ffe08f]",
    coral: "bg-coral text-ink border-[#8f231c] hover:bg-[#ff8478]",
    ghost: "bg-moss text-foam border-[#08150e] hover:bg-fern",
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={() => {
        sfx.unlock();
        sfx.click();
        onClick();
      }}
      className={`
        font-display uppercase inline-flex items-center justify-center gap-2 select-none
        ${big ? "text-[11px] px-6 py-4" : "text-[9px] px-3.5 py-2.5"}
        rounded-md border-b-4 transition-all duration-100 active:translate-y-[3px] active:border-b-0
        disabled:opacity-35 disabled:pointer-events-none cursor-pointer
        ${styles[variant]} ${className}
      `}
    >
      {children}
    </button>
  );
}

export function IconBtn({
  onClick,
  title,
  disabled = false,
  children,
  className = "",
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={() => {
        sfx.unlock();
        sfx.click();
        onClick();
      }}
      className={`w-10 h-10 grid place-items-center rounded-md bg-moss border border-line border-b-4 border-b-[#08150e]
        text-mint hover:bg-fern hover:text-lime active:translate-y-[2px] active:border-b transition-all duration-100
        disabled:opacity-35 disabled:pointer-events-none cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, children, accent }: { label: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center gap-2 bg-pit/90 border border-line rounded-md px-3 py-2 min-w-0">
      <span className="font-display text-[8px] text-fog tracking-wider">{label}</span>
      <span className={`font-display text-sm sm:text-base tabular-nums ${accent ?? "text-foam"}`}>{children}</span>
    </div>
  );
}

export function DPad({
  children,
  onPress,
  label,
  center = false,
  wide = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  center?: boolean;
  wide?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        sfx.unlock();
        if (!disabled) onPress();
      }}
      className={`
        grid place-items-center rounded-lg border border-line border-b-4 border-b-[#04100a]
        bg-gradient-to-b from-fern to-moss text-mint active:text-lime
        active:translate-y-[2px] active:border-b-2 transition-all duration-75 touch-none cursor-pointer
        disabled:opacity-35 disabled:pointer-events-none
        ${wide ? "w-16 h-[52px]" : "w-[52px] h-[52px]"}
        ${center ? "bg-gradient-to-b from-moss to-pit text-lime" : ""}
      `}
    >
      {children}
    </button>
  );
}