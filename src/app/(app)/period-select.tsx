"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SimpleSelect } from "@/components/forms/fields";
import { periodOptions } from "@/lib/periods";

export function PeriodSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <SimpleSelect
      value={value}
      onChange={(v) => {
        const p = new URLSearchParams(params.toString());
        p.set("periodo", v ?? "mes");
        router.replace(`${pathname}?${p.toString()}`, { scroll: false });
      }}
      options={periodOptions.map((o) => ({ value: o.value, label: o.label }))}
      className="h-7 w-44"
    />
  );
}
