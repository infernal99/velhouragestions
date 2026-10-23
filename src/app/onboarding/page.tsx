import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getContext, getUserId } from "@/lib/auth/context";
import { OnboardingForm } from "./onboarding-form";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Configurar empresa" };

export default async function OnboardingPage() {
  if (!(await getUserId())) redirect("/login");
  if (await getContext()) redirect("/");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-7">
        <h1 className="text-lg font-semibold">Configura tu empresa</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Crea el espacio de trabajo de tu empresa. Serás su administrador y podrás invitar al resto del equipo y
          cambiar el nombre, el logotipo y los colores cuando quieras desde Ajustes.
        </p>
        <OnboardingForm />
        <div className="mt-6 border-t pt-4 text-sm text-muted-foreground">
          ¿Te han invitado a una empresa existente? Abre el enlace de la invitación que recibiste por correo.
        </div>
      </div>
      <form action={signOut} className="mt-4">
        <Button variant="ghost" size="sm" type="submit">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
