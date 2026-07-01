import type { ButtonHTMLAttributes } from "react";

const base =
  "inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:pointer-events-none";

const variants = {
  /** Acción primaria. Latón = marca. Texto en `ink` (contrasta en ambos modos). */
  primary: "bg-brass text-ink px-4 py-2.5 hover:bg-brass-bright",
  /** Acción secundaria / neutral. */
  ghost: "border border-line-2 text-fg px-4 py-2.5 hover:bg-surface-2 hover:border-brass",
  /** Acción terciaria, como un enlace. */
  quiet: "text-muted hover:text-brass",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
