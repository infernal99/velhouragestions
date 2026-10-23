"use client";

import { useEffect, useRef, useTransition } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import type { ActionResult } from "@/lib/actions/result";

/**
 * React Hook Form + Zod on the client, the same schema re-checked by the
 * server action. Server field errors are mapped back onto the inputs.
 */
export function useActionForm<S extends z.ZodType<FieldValues, FieldValues>, R = unknown>({
  schema,
  defaultValues,
  action,
  onSuccess,
  successMessage,
}: {
  schema: S;
  defaultValues: DefaultValues<z.input<S>>;
  action: (values: z.output<S>) => Promise<ActionResult<R>>;
  onSuccess?: (data: R) => void;
  successMessage?: string;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema as never),
    defaultValues,
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await action(values);
      if (!result) return; // action redirected
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as Path<z.input<S>>, { message });
        }
        toast.error(result.error);
        return;
      }
      if (result.message ?? successMessage) toast.success(result.message ?? successMessage);
      onSuccess?.(result.data);
    });
  });

  return { form, onSubmit, pending };
}

/**
 * Reset a dialog's form to fresh defaults each time it opens (and only
 * then — defaults objects created inline would otherwise reset on every
 * render while the user is typing).
 */
export function useResetOnOpen<T extends FieldValues>(
  open: boolean,
  form: { reset: (values: DefaultValues<T>) => void },
  getDefaults: () => DefaultValues<T>,
) {
  const wasOpen = useRef(false);
  const latest = useRef(getDefaults);
  useEffect(() => {
    latest.current = getDefaults;
  });
  useEffect(() => {
    if (open && !wasOpen.current) form.reset(latest.current());
    wasOpen.current = open;
  }, [open, form]);
}

/** Run a one-off action (button click) with toasts. */
export async function runAction<R>(
  promise: Promise<ActionResult<R>>,
  successMessage?: string,
): Promise<ActionResult<R>> {
  const result = await promise;
  // an action that redirected resolves to undefined
  if (!result) return { ok: true, data: undefined as R };
  if (!result.ok) {
    toast.error(result.error);
    return result;
  }
  if (result.message ?? successMessage) toast.success(result.message ?? successMessage);
  return result;
}
