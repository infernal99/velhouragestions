import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/context";
import { PageHeader } from "@/components/shared/page-header";
import { CompanyCalendar } from "./company-calendar";

export const metadata: Metadata = { title: "Calendario" };

export default async function CalendarPage() {
  await requireContext();
  return (
    <>
      <PageHeader title="Calendario" description="Reuniones, entregas, llamadas, revisiones, renovaciones y recordatorios del equipo." />
      <CompanyCalendar />
    </>
  );
}
