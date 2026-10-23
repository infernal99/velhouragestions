"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ProjectFormDialog, type ProjectFormValues } from "@/components/projects/project-form-dialog";
import { TaskFormDialog, type TaskFormValues } from "@/components/tasks/task-form-dialog";
import { EventFormDialog, type EventFormValues } from "@/components/calendar/event-form-dialog";
import { QuoteCreateDialog } from "@/components/finance/quote-create-dialog";

type CreateRequest =
  | { kind: "project"; defaults?: ProjectFormValues }
  | { kind: "client" }
  | { kind: "task"; defaults?: TaskFormValues }
  | { kind: "event"; defaults?: EventFormValues }
  | { kind: "quote"; clientId?: string | null };

const CreateContext = createContext<(req: CreateRequest) => void>(() => {});

/** One place that owns the "create X" modals, reachable from anywhere. */
export function CreateDialogsProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<CreateRequest | null>(null);
  const router = useRouter();
  const open = useCallback((r: CreateRequest) => setReq(r), []);
  const close = (o: boolean) => {
    if (!o) setReq(null);
  };

  return (
    <CreateContext.Provider value={open}>
      {children}
      <ProjectFormDialog
        open={req?.kind === "project"}
        onOpenChange={close}
        project={req?.kind === "project" ? req.defaults : undefined}
      />
      <ClientFormDialog
        open={req?.kind === "client"}
        onOpenChange={close}
        onSaved={(id) => router.push(`/clientes/${id}`)}
      />
      <TaskFormDialog open={req?.kind === "task"} onOpenChange={close} task={req?.kind === "task" ? req.defaults : undefined} />
      <EventFormDialog
        open={req?.kind === "event"}
        onOpenChange={close}
        event={req?.kind === "event" ? req.defaults : undefined}
      />
      <QuoteCreateDialog open={req?.kind === "quote"} onOpenChange={close} clientId={req?.kind === "quote" ? req.clientId : null} />
    </CreateContext.Provider>
  );
}

export function useCreate() {
  return useContext(CreateContext);
}
