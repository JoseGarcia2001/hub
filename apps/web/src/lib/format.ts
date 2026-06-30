export function money(n: number, currency = "USD", min = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: min,
    maximumFractionDigits: 2,
  }).format(n);
}

export function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}
