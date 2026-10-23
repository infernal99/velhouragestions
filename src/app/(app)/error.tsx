"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Never shows technical details to the user; they go to the console/logs.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50svh] flex-col items-center justify-center gap-3 text-center">
      <div className="grid size-12 place-items-center rounded-xl bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <h1 className="text-lg font-semibold">Algo no ha ido bien</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        No hemos podido cargar esta sección. Vuelve a intentarlo; si el problema continúa, avisa a un administrador.
      </p>
      {error.digest ? <p className="font-mono text-xs text-muted-foreground">Ref.: {error.digest}</p> : null}
      <Button variant="outline" onClick={reset} className="mt-2">
        <RotateCcw /> Reintentar
      </Button>
    </div>
  );
}
