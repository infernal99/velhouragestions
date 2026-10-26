import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { BrandStyle } from "@/components/shell/brand-style";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { PrintButton } from "./print-button";
import type { Client, Quote, QuoteLine } from "@/types/database";

export async function generateMetadata({ params }: PageProps<"/imprimir/presupuesto/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("quotes").select("number").eq("id", id).maybeSingle();
  return { title: data ? `Presupuesto ${data.number}` : "Presupuesto" };
}

/**
 * Print-optimised quote. "Guardar como PDF" uses the browser's print dialog.
 * It is a commercial offer, explicitly NOT an invoice.
 */
export default async function PrintQuotePage({ params }: PageProps<"/imprimir/presupuesto/[id]">) {
  const { id } = await params;
  const ctx = await requireCapability("finances");
  const supabase = await createClient();
  const [{ data: quote }, { data: lines }] = await Promise.all([
    supabase
      .from("quotes")
      .select("*, client:clients(*)")
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .maybeSingle<Quote & { client: Client | null }>(),
    supabase.from("quote_lines").select("*").eq("quote_id", id).order("position").returns<QuoteLine[]>(),
  ]);
  if (!quote) notFound();

  const co = ctx.company;
  // no tax column or total when the quote has no taxes
  const hasTax = Number(quote.tax_total) > 0 || (lines ?? []).some((l) => Number(l.tax_pct) > 0);
  const c = co.currency;
  const companyLines = [co.legal_name ?? co.name, co.tax_id ? `NIF: ${co.tax_id}` : null, co.address, [co.postal_code, co.city].filter(Boolean).join(" "), co.email, co.phone, co.website].filter(Boolean);
  const cl = quote.client;
  const clientLines = cl
    ? [cl.legal_name ?? cl.name, cl.tax_id ? `NIF/CIF: ${cl.tax_id}` : null, cl.address, cl.contact_name ? `A la atención de ${cl.contact_name}` : null, cl.email].filter(Boolean)
    : [];

  return (
    <div className="min-h-svh bg-surface print:bg-white">
      <BrandStyle color={co.primary_color} />
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 px-4 py-2 backdrop-blur">
        <p className="text-sm text-muted-foreground">Vista previa de impresión · usa «Guardar como PDF» en el diálogo de impresión</p>
        <PrintButton />
      </div>
      <article className="mx-auto my-6 max-w-[210mm] bg-white p-[14mm] text-[13px] text-zinc-900 shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-8">
          <div>
            {co.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- public logo URL
              <img src={co.logo_url} alt={co.name} className="mb-3 h-12 w-auto object-contain" />
            ) : (
              <p className="mb-2 text-xl font-semibold" style={{ color: co.primary_color }}>
                {co.name}
              </p>
            )}
            <div className="text-xs leading-relaxed text-zinc-600">
              {companyLines.map((l) => (
                <p key={l as string}>{l}</p>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight">Presupuesto</p>
            <p className="mt-1 font-mono text-sm">{quote.number}</p>
            <p className="mt-3 text-xs text-zinc-600">Fecha: {formatDate(quote.issue_date)}</p>
            {quote.valid_until ? <p className="text-xs text-zinc-600">Válido hasta: {formatDate(quote.valid_until)}</p> : null}
          </div>
        </header>

        <section className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Cliente</p>
            {clientLines.length ? (
              <div className="leading-relaxed">
                {clientLines.map((l) => (
                  <p key={l as string}>{l}</p>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500">—</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Concepto</p>
            <p className="font-medium">{quote.title}</p>
          </div>
        </section>

        <table className="mt-8 w-full border-collapse">
          <thead>
            <tr className="border-b-2 text-left text-[11px] tracking-wide text-zinc-500 uppercase" style={{ borderColor: co.primary_color }}>
              <th className="py-2 pr-2 font-semibold">Descripción</th>
              <th className="w-16 py-2 text-right font-semibold">Cant.</th>
              <th className="w-24 py-2 text-right font-semibold">Precio</th>
              <th className="w-14 py-2 text-right font-semibold">Dto.</th>
              {hasTax ? <th className="w-14 py-2 text-right font-semibold">IVA</th> : null}
              <th className="w-28 py-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-zinc-200 align-top">
                <td className="py-2.5 pr-2 whitespace-pre-wrap">{l.description}</td>
                <td className="py-2.5 text-right tabular">{formatNumber(Number(l.quantity), 2)}</td>
                <td className="py-2.5 text-right tabular">{formatMoney(l.unit_price, c)}</td>
                <td className="py-2.5 text-right tabular">{Number(l.discount_pct) ? `${formatNumber(Number(l.discount_pct), 2)} %` : "—"}</td>
                {hasTax ? <td className="py-2.5 text-right tabular">{formatNumber(Number(l.tax_pct), 2)} %</td> : null}
                <td className="py-2.5 text-right tabular">{formatMoney(l.line_subtotal, c)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 flex justify-end">
          <dl className="w-72 text-sm">
            <div className="flex justify-between py-1">
              <dt className="text-zinc-600">Subtotal</dt>
              <dd className="tabular">{formatMoney(quote.subtotal, c)}</dd>
            </div>
            {Number(quote.discount_total) ? (
              <div className="flex justify-between py-1">
                <dt className="text-zinc-600">Descuentos</dt>
                <dd className="tabular">−{formatMoney(quote.discount_total, c)}</dd>
              </div>
            ) : null}
            {hasTax ? (
              <>
                <div className="flex justify-between py-1">
                  <dt className="text-zinc-600">Base imponible</dt>
                  <dd className="tabular">{formatMoney(Number(quote.subtotal) - Number(quote.discount_total), c)}</dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-zinc-600">Impuestos</dt>
                  <dd className="tabular">{formatMoney(quote.tax_total, c)}</dd>
                </div>
              </>
            ) : null}
            <div className="mt-1 flex justify-between border-t-2 pt-2 text-base font-semibold" style={{ borderColor: co.primary_color }}>
              <dt>Total</dt>
              <dd className="tabular">{formatMoney(quote.total, c)}</dd>
            </div>
          </dl>
        </section>

        {quote.notes || quote.terms ? (
          <section className="mt-10 grid grid-cols-2 gap-8 text-xs leading-relaxed">
            {quote.notes ? (
              <div>
                <p className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Notas</p>
                <p className="whitespace-pre-wrap">{quote.notes}</p>
              </div>
            ) : (
              <span />
            )}
            {quote.terms ? (
              <div>
                <p className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Condiciones</p>
                <p className="whitespace-pre-wrap">{quote.terms}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        <footer className="mt-12 border-t border-zinc-200 pt-3 text-[10px] text-zinc-500">
          Documento informativo: este presupuesto no es una factura ni tiene validez fiscal.
        </footer>
      </article>
    </div>
  );
}
