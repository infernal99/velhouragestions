import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-lg font-semibold">No encontramos lo que buscas</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Puede que se haya eliminado o que no tengas acceso a este elemento.
      </p>
      <Button render={<Link href="/" />} nativeButton={false} variant="outline" className="mt-2">
        Volver al inicio
      </Button>
    </div>
  );
}
