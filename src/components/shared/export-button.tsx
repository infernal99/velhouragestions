"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Downloads a CSV from /api/exportar/<tipo> (the route checks permissions). */
export function ExportButton({ tipo, label = "CSV", from, to }: { tipo: string; label?: string; from?: string; to?: string }) {
  const qs = from && to ? `?desde=${from}&hasta=${to}` : "";
  return (
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- file download from an API route, not a page
    <Button variant="outline" size="sm" onClick={() => window.location.assign(`/api/exportar/${tipo}${qs}`)}>
      <Download /> {label}
    </Button>
  );
}
