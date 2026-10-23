import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { OptionBadge } from "@/components/shared/status-badge";
import { quoteStatusMap } from "@/lib/labels";
import { QuoteEditor } from "./quote-editor";
import type { Quote, QuoteLine } from "@/types/database";

export async function generateMetadata({ params }: PageProps<"/finanzas/presupuestos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("quotes").select("number").eq("id", id).maybeSingle();
  return { title: data ? `Presupuesto ${data.number}` : "Presupuesto" };
}

export default async function QuotePage({ params }: PageProps<"/finanzas/presupuestos/[id]">) {
  const { id } = await params;
  const ctx = await requireCapability("finances");
  const supabase = await createClient();
  const [{ data: quote }, { data: lines }, { data: receivable }] = await Promise.all([
    supabase
      .from("quotes")
      .select("*, client:clients(id, name), project:projects(id, name)")
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .maybeSingle<Quote & { client: { id: string; name: string } | null; project: { id: string; name: string } | null }>(),
    supabase.from("quote_lines").select("*").eq("quote_id", id).order("position").returns<QuoteLine[]>(),
    supabase.from("receivables").select("id").eq("quote_id", id).limit(1),
  ]);
  if (!quote) notFound();

  return (
    <>
      <Link href="/finanzas/presupuestos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Presupuestos
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-muted-foreground">{quote.number}</span>
        <h1 className="text-2xl font-semibold tracking-tight">{quote.title}</h1>
        <OptionBadge value={quote.status} map={quoteStatusMap} />
      </div>
      <QuoteEditor
        quote={quote}
        lines={lines ?? []}
        hasReceivable={Boolean(receivable?.length)}
        defaultTax={Number(ctx.company.default_tax_rate)}
      />
    </>
  );
}
