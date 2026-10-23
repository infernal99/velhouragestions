"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReceivableFormDialog } from "@/components/finance/receivable-form-dialog";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";

export function FinanceButtons({ kind, projectId, clientId }: { kind: "receivable" | "expense"; projectId?: string; clientId?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus /> {kind === "receivable" ? "Cobro" : "Gasto"}
      </Button>
      {kind === "receivable" ? (
        <ReceivableFormDialog open={open} onOpenChange={setOpen} defaults={{ project_id: projectId ?? null, client_id: clientId ?? null }} />
      ) : (
        <ExpenseFormDialog open={open} onOpenChange={setOpen} defaults={{ project_id: projectId ?? null }} />
      )}
    </>
  );
}
