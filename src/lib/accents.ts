// A small palette of accent colours layered on the black/white base. Each
// accent is a tinted chip (soft background + saturated icon) that works in
// both light and dark mode.

export type Accent = "brand" | "emerald" | "amber" | "rose" | "sky" | "violet" | "teal" | "orange";

export const accentChip: Record<Accent, string> = {
  brand: "bg-brand/12 text-brand",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/14 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  sky: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  teal: "bg-teal-500/12 text-teal-600 dark:text-teal-400",
  orange: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
};

export const accentText: Record<Accent, string> = {
  brand: "text-brand",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  sky: "text-sky-600 dark:text-sky-400",
  violet: "text-violet-600 dark:text-violet-400",
  teal: "text-teal-600 dark:text-teal-400",
  orange: "text-orange-600 dark:text-orange-400",
};

/** Soft tint behind a card, in the accent's colour (works in light and dark). */
export const accentGradient: Record<Accent, string> = {
  brand: "bg-gradient-to-br from-brand/[0.08] via-card to-card",
  emerald: "bg-gradient-to-br from-emerald-500/[0.08] via-card to-card",
  amber: "bg-gradient-to-br from-amber-500/[0.09] via-card to-card",
  rose: "bg-gradient-to-br from-rose-500/[0.08] via-card to-card",
  sky: "bg-gradient-to-br from-sky-500/[0.08] via-card to-card",
  violet: "bg-gradient-to-br from-violet-500/[0.08] via-card to-card",
  teal: "bg-gradient-to-br from-teal-500/[0.08] via-card to-card",
  orange: "bg-gradient-to-br from-orange-500/[0.08] via-card to-card",
};

/** Hex colours for charts (SVG), matching the accents above. */
export const accentHex: Record<Accent, string> = {
  brand: "var(--brand)",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
  teal: "#14b8a6",
  orange: "#f97316",
};

export const POSITIVE_COLOR = "#10b981";
export const NEGATIVE_COLOR = "#f43f5e";

export type ValueTone = "positive" | "negative" | "warning" | "neutral";

/** positive → green, negative → red, zero → neutral. */
export function toneOf(value: number | string | null | undefined): ValueTone {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "positive" : "negative";
}

export const valueToneClass: Record<ValueTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  neutral: "",
};

const AVATAR_ACCENTS: Accent[] = ["brand", "emerald", "amber", "rose", "sky", "violet", "teal", "orange"];

/** Stable accent for a name, so each person always gets the same colour. */
export function accentForName(name: string | null | undefined): Accent {
  const s = name ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_ACCENTS[h % AVATAR_ACCENTS.length];
}
