/* eslint-disable @next/next/no-img-element -- logo comes from a public storage URL of unknown size */
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CompanyMark({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={name} className={cn("size-7 rounded-md object-contain", className)} />;
  }
  return (
    <div className={cn("grid size-7 place-items-center rounded-md bg-brand text-[11px] font-semibold text-brand-foreground", className)}>
      {initials(name)}
    </div>
  );
}
