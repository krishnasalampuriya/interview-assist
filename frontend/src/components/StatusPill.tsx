import { clsx } from "clsx";

type StatusPillProps = {
  label: string;
  tone?: "neutral" | "success" | "warning" | "accent";
};

const tones = {
  neutral: "border-line bg-white text-ink",
  success: "border-teal-200 bg-teal-50 text-teal-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  accent: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
};

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", tones[tone])}>
      {label}
    </span>
  );
}
