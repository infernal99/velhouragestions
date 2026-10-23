import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="text-lg font-semibold">Iniciar sesión</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Accede con tu correo y contraseña.</p>
      {error ? (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          El enlace no es válido o ha caducado. Inténtalo de nuevo.
        </p>
      ) : null}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href="/recuperar" className="text-muted-foreground hover:text-foreground">
          ¿Has olvidado la contraseña?
        </Link>
        <Link href={`/registro${typeof next === "string" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium hover:underline">
          Crear cuenta
        </Link>
      </div>
    </>
  );
}
