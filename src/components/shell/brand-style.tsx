// Injects the company's brand colour as a CSS variable. The value is
// validated as #rrggbb by a DB constraint, so it is safe to interpolate.

function readableForeground(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#111113" : "#ffffff";
}

export function BrandStyle({ color }: { color: string }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#4f46e5";
  return (
    <style>{`:root{--brand:${safe};--brand-foreground:${readableForeground(safe)}}`}</style>
  );
}
