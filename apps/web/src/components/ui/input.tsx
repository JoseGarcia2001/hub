import type { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-line-2 bg-transparent px-3 py-2 text-sm text-fg placeholder:text-faint transition focus:border-brass ${className}`}
      {...props}
    />
  );
}
