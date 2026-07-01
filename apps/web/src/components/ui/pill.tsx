import type { ReactNode } from "react";

const tones = {
  up: "bg-up-dim text-up",
  down: "bg-down-dim text-down",
  brass: "bg-brass-dim text-brass",
  ghost: "border border-line-2 text-muted",
  soon: "border border-line text-faint uppercase tracking-wider font-mono",
} as const;

/** Estado codificado en forma, no solo en color. up/down = valor; brass = marca. */
export function Pill({ children, tone = "ghost" }: { children: ReactNode; tone?: keyof typeof tones }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
