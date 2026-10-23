"use client";

import { useEffect, useState } from "react";
import { getLookups, type Lookups } from "@/lib/actions/lookups";

const EMPTY: Lookups = { clients: [], projects: [], expenseCategories: [], webStages: [] };

/** Loads select options when a dialog opens (fresh every time it opens). */
export function useLookups(enabled: boolean) {
  const [data, setData] = useState<Lookups>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for a fetch started by this effect
    setLoading(true);
    void getLookups().then((res) => {
      if (cancelled) return;
      if (res.ok) setData(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { ...data, loading };
}
