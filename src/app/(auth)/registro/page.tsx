import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: PageProps<"/registro">) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-lg font-semibold">Crear cuenta</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Si te han invitado, usa el mismo correo al que llegó la invitación.
      </p>
      <RegisterForm next={typeof next === "string" ? next : undefined} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}
