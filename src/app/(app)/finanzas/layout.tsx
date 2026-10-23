import { requireCapability } from "@/lib/auth/context";

// Every finance page requires finance access (admins, or members granted it).
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireCapability("finances");
  return children;
}
