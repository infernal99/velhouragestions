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

const AVATAR_ACCENTS: Accent[] = ["brand", "emerald", "amber", "rose", "sky", "violet", "teal", "orange"];

/** Stable accent for a name, so each person always gets the same colour. */
export function accentForName(name: string | null | undefined): Accent {
  const s = name ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_ACCENTS[h % AVATAR_ACCENTS.length];
}
