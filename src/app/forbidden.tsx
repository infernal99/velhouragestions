import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="grid size-12 place-items-center rounded-xl bg-muted">
        <ShieldAlert className="size-6 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-semibold">No tienes acceso a esta sección</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Pide a un administrador que te conceda el permiso correspondiente si lo necesitas.
      </p>
      <Button render={<Link href="/" />} nativeButton={false} variant="outline" className="mt-2">
        Volver al inicio
      </Button>
    </div>
  );
}
