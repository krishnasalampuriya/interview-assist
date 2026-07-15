import { clsx } from "clsx";

type StatusPillProps = {
  label: string;
  tone?: "neutral" | "success" | "warning" | "accent";
};

const tones = {
  neutral: "border-zinc-200 bg-white/85 text-zinc-700 before:bg-zinc-400",
  success: "border-teal-200 bg-teal-50 text-teal-800 before:bg-teal-500",
  warning: "border-amber-200 bg-amber-50 text-amber-800 before:bg-amber-500",
  accent: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 before:bg-fuchsia-500",
};

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm before:h-1.5 before:w-1.5 before:rounded-full",
        tones[tone],
      )}
    >
      {label}
    </span>
  );
}
