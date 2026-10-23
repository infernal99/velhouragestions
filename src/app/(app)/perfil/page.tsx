import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/context";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForms } from "./profile-forms";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const ctx = await requireContext();
  return (
    <>
      <PageHeader title="Mi perfil" description="Tu nombre, foto y puesto son visibles para el resto del equipo." />
      <ProfileForms
        profile={{
          full_name: ctx.profile.full_name,
          email: ctx.profile.email,
          job_title: ctx.profile.job_title,
          phone: ctx.profile.phone,
          avatar_url: ctx.profile.avatar_url,
        }}
        role={ctx.membership.role}
      />
    </>
  );
}
